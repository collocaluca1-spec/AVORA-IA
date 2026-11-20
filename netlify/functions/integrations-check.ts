import type { Config } from '@netlify/functions'
import { INTEGRATIONS, INTEGRATION_KEYS, type IntegrationKey, type IntegrationStatus } from '../../shared/integrations.ts'
import { requireTeamMember } from '../lib/auth.ts'
import { handleError, json } from '../lib/http.ts'
import { logServer, supabaseAdmin } from '../lib/supabaseAdmin.ts'
import { resolveTextProvider } from '../lib/agent/providers.ts'
import { resolveStockProvider } from '../lib/media/stock.ts'

/**
 * Describe la forma de una clave SIN revelarla, para diagnosticar errores de
 * copiado (comillas, espacios, prefijo equivocado, longitud).
 */
function describeKey(raw: string): string {
  const k = raw.trim()
  const hints: string[] = []
  if (raw !== k) hints.push('tiene espacios al principio o al final')
  if (/^["']|["']$/.test(k)) hints.push('está entre comillas')
  if (/\s/.test(k)) hints.push('tiene espacios o saltos de línea en el medio')
  if (!k.startsWith('sk-ant-')) hints.push('no empieza con "sk-ant-"')
  else if (!k.startsWith('sk-ant-api')) hints.push('no es una clave de API común (debería empezar con "sk-ant-api")')
  if (k.length < 90) hints.push(`es muy corta (${k.length} caracteres)`)
  return hints.length
    ? `La clave cargada ${hints.join(', ')}.`
    : `La clave tiene el formato correcto (${k.length} caracteres): puede estar desactivada, borrada o ser de otra cuenta. Creá una nueva y reemplazala.`
}

/** Verificación real contra el servicio, para las integraciones que ya la tienen. */
const VERIFIERS: Partial<Record<IntegrationKey, () => Promise<{ provider: string } | null>>> = {
  async ai_text() {
    const { provider } = resolveTextProvider()
    if (!provider) return null
    try {
      if (!(await provider.verify())) throw new Error('El proveedor rechazó la verificación.')
    } catch (e) {
      const status = (e as { status?: number }).status
      if (status === 401 || status === 403) throw new Error(`Anthropic rechazó la clave. ${describeKey(process.env.AI_TEXT_API_KEY ?? '')}`)
      throw e
    }
    return { provider: provider.name }
  },
  async stock_media() {
    const stock = resolveStockProvider()
    if (!stock) return null
    await stock.verify()
    return { provider: stock.name }
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
      const present = key === 'stock_media' ? resolveStockProvider() !== null : def.envVars.length > 0 && def.envVars.every((v) => Boolean(process.env[v]?.trim()))
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
