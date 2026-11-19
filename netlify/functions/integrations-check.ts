import type { Config } from '@netlify/functions'
import { INTEGRATIONS, INTEGRATION_KEYS, type IntegrationStatus } from '../../shared/integrations.ts'
import { requireTeamMember } from '../lib/auth.ts'
import { handleError, json } from '../lib/http.ts'
import { logServer, supabaseAdmin } from '../lib/supabaseAdmin.ts'

/**
 * Revisa qué credenciales existen en el servidor y actualiza la tabla `integrations`.
 *
 * Fase 1: solo comprueba PRESENCIA de variables (estado "credentials_present").
 * Nunca marca "connected": eso lo hará cada integración cuando se implemente
 * su verificación real contra el servicio (fases 2–4). No se exponen valores.
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
      if (current?.status === 'disabled' || current?.status === 'connected') {
        results[key] = current.status
        continue
      }
      const present = def.envVars.length > 0 && def.envVars.every((v) => Boolean(process.env[v]?.trim()))
      const status: IntegrationStatus = present ? 'credentials_present' : 'not_configured'
      const provider = key.startsWith('ai_') ? process.env[def.envVars[0]]?.trim() || null : null
      await db
        .from('integrations')
        .update({
          status,
          provider,
          last_checked_at: new Date().toISOString(),
          last_error: null,
          details: { env_vars: def.envVars.map((v) => ({ name: v, present: Boolean(process.env[v]?.trim()) })) },
        })
        .eq('key', key)
      results[key] = status
    }

    await logServer('integrations.checked', 'Verificación de credenciales en el servidor', { actorId: user.id, details: results })
    const configured = Object.values(results).filter((s) => s !== 'not_configured').length
    return json({
      ok: true,
      results,
      message:
        configured === 0
          ? 'Verificación realizada: ninguna integración tiene credenciales cargadas en el servidor.'
          : `Verificación realizada: ${configured} integración(es) con credenciales cargadas (pendientes de verificación real).`,
    })
  } catch (err) {
    return handleError(err)
  }
}

export const config: Config = { path: '/api/integrations-check' }
