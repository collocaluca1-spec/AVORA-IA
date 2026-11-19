import type { Config } from '@netlify/functions'
import { INTEGRATIONS, INTEGRATION_KEYS, type IntegrationKey, type IntegrationStatus } from '../../shared/integrations.ts'
import { requireTeamMember } from '../lib/auth.ts'
import { handleError, json } from '../lib/http.ts'
import { logServer, supabaseAdmin } from '../lib/supabaseAdmin.ts'
import { resolveTextProvider } from '../lib/agent/providers.ts'
import { pexelsKey, verifyPexels } from '../lib/media/pexels.ts'

/** Verificación real contra el servicio, para las integraciones que ya la tienen. */
const VERIFIERS: Partial<Record<IntegrationKey, () => Promise<{ provider: string } | null>>> = {
  async ai_text() {
    const { provider } = resolveTextProvider()
    if (!provider) return null
    if (!(await provider.verify())) throw new Error('El proveedor rechazó la verificación.')
    return { provider: provider.name }
  },
  async stock_media() {
    const key = pexelsKey()
    if (!key) return null
    await verifyPexels(key)
    return { provider: 'pexels' }
  },
}

/**
 * Revisa qué credenciales existen en el servidor y actualiza la tabla `integrations`.
 * Las integraciones con verificador se prueban contra el servicio real y recién
 * ahí quedan "connected". El resto solo informa presencia de variables.
 * Nunca se exponen valores.
 */
export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  try {
    const user = await requireTeamMember(req)
    const db = supabaseAdmin()
    const results: Record<string, IntegrationStatus> = {}

    for (const key of INTEGRATION_KEYS) {
      const def = INTEGRATIONS[key]
      const { data: current } = await db.from('integrations').select('status').eq('key', key).single()
      if (current?.status === 'disabled') {
        results[key] = current.status
        continue
      }
      const present = def.envVars.length > 0 && def.envVars.every((v) => Boolean(process.env[v]?.trim()))
      let status: IntegrationStatus = present ? 'credentials_present' : 'not_configured'
      let provider = key.startsWith('ai_') ? process.env[def.envVars[0]]?.trim() || null : null
      let lastError: string | null = null
      const verify = VERIFIERS[key]
      if (present && verify) {
        try {
          const ok = await verify()
          if (ok) {
            status = 'connected'
            provider = ok.provider
          }
        } catch (e) {
          status = 'error'
          lastError = e instanceof Error ? e.message : String(e)
        }
      }
      await db
        .from('integrations')
        .update({
          status,
          provider,
          last_checked_at: new Date().toISOString(),
          last_error: lastError,
          details: { env_vars: def.envVars.map((v) => ({ name: v, present: Boolean(process.env[v]?.trim()) })) },
        })
        .eq('key', key)
      results[key] = status
    }

    // La primera vez que la IA de texto queda conectada, se activa la planificación
    // semanal automática (se puede apagar en Configuración → Automatizaciones).
    const { data: before } = await db.from('activity_log').select('id').eq('action', 'agent.auto_enabled').limit(1)
    if (results.ai_text === 'connected' && !before?.length) {
      const { data: auto } = await db.from('app_settings').select('value').eq('key', 'automations').single()
      if (auto && !auto.value?.agent_auto_proposals) {
        await db.from('app_settings').update({ value: { ...auto.value, agent_auto_proposals: true } }).eq('key', 'automations')
      }
      await logServer('agent.auto_enabled', 'Se activó la planificación semanal automática del agente', { actorId: user.id })
    }

    await logServer('integrations.checked', 'Verificación de credenciales en el servidor', { actorId: user.id, details: results })
    const configured = Object.values(results).filter((s) => s !== 'not_configured').length
    return json({
      ok: true,
      results,
      message:
        configured === 0
          ? 'Verificación realizada: ninguna integración tiene credenciales cargadas en el servidor.'
          : `Verificación realizada: ${Object.values(results).filter((s) => s === 'connected').length} conectada(s), ${configured} con credenciales cargadas.`,
    })
  } catch (err) {
    return handleError(err)
  }
}

export const config: Config = { path: '/api/integrations-check' }
