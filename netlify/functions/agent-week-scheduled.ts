import type { Config } from '@netlify/functions'
import { dispatchRun, queueAgentTask } from '../lib/agent/runner.ts'
import { logServer, supabaseAdmin } from '../lib/supabaseAdmin.ts'

/**
 * Todos los jueves a las 9:00 de Argentina (12:00 UTC; Argentina no tiene horario
 * de verano) el agente arma la semana siguiente, si la automatización está activa
 * en Configuración → Automatizaciones. Todo queda pendiente de aprobación.
 */
export default async () => {
  const db = supabaseAdmin()
  const { data } = await db.from('app_settings').select('value').eq('key', 'automations').single()
  if (!data?.value?.agent_auto_proposals) return
  const site = process.env.URL
  if (!site) return
  try {
    const runId = await queueAgentTask('plan_week', {}, null)
    await dispatchRun(site, runId)
  } catch (err) {
    await logServer('agent.schedule_failed', 'No se pudo iniciar la planificación semanal', {
      level: 'error',
      details: { message: err instanceof Error ? err.message : String(err) },
    })
  }
}

export const config: Config = { schedule: '0 12 * * 4' }
