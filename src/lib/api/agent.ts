import { db } from '../supabase'

export type AgentTask = 'research_destination' | 'propose_ideas' | 'write_copy' | 'travel_tips' | 'seasonal_recommendations' | 'plan_week'

export interface AgentResult {
  ok: boolean
  message: string
  data?: unknown
}

/** Inicia una tarea del agente en el servidor. Devuelve el id de la ejecución. */
export async function startAgent(task: AgentTask, input: Record<string, unknown>): Promise<AgentResult & { runId?: string }> {
  const { data: s } = await db().auth.getSession()
  let res: Response
  try {
    res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${s.session?.access_token}` },
      body: JSON.stringify({ task, input }),
    })
  } catch {
    return { ok: false, message: 'No se pudo contactar a las funciones de servidor.' }
  }
  if (!(res.headers.get('content-type') ?? '').includes('application/json'))
    return { ok: false, message: 'Las funciones de servidor no están disponibles en este entorno.' }
  const body = await res.json()
  return { ok: res.ok, message: body.message ?? (res.ok ? 'Listo.' : 'Error'), data: body, runId: body.run_id }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Espera a que termine una ejecución (las tareas con investigación tardan unos minutos). */
export async function waitForRun(runId: string, timeoutMs = 16 * 60_000): Promise<AgentResult> {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    await sleep(4000)
    const { data } = await db().from('agent_runs').select('status, output, error').eq('id', runId).maybeSingle()
    if (!data) continue
    if (data.status === 'succeeded')
      return { ok: true, message: (data.output as any)?.summary ?? 'El agente terminó.', data: data.output }
    if (data.status === 'failed' || data.status === 'not_configured')
      return { ok: false, message: data.error ?? 'El agente no pudo completar la tarea.' }
  }
  return { ok: false, message: 'El agente sigue trabajando. Revisá el historial en unos minutos.' }
}

export async function runAgent(task: AgentTask, input: Record<string, unknown>): Promise<AgentResult> {
  const started = await startAgent(task, input)
  if (!started.ok || !started.runId) return started
  return waitForRun(started.runId)
}
