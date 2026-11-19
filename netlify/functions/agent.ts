import type { Config } from '@netlify/functions'
import { requireTeamMember } from '../lib/auth.ts'
import { handleError, HttpError, json } from '../lib/http.ts'
import { dispatchRun, queueAgentTask } from '../lib/agent/runner.ts'
import { RUNNABLE_TASKS, type RunnableTask } from '../lib/agent/tasks.ts'

/**
 * POST /api/agent  { task, input } → deja la tarea en cola y la inicia en segundo
 * plano. Responde 202 con el id de la ejecución; el panel sigue su estado en agent_runs.
 */
export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  try {
    const user = await requireTeamMember(req)
    const body = (await req.json().catch(() => ({}))) as { task?: string; input?: Record<string, unknown> }
    if (!body.task || !RUNNABLE_TASKS.includes(body.task as RunnableTask))
      throw new HttpError(400, 'invalid_task', 'Tarea desconocida.')
    const runId = await queueAgentTask(body.task as RunnableTask, body.input ?? {}, user.id)
    await dispatchRun(new URL(req.url).origin, runId)
    return json({ ok: true, run_id: runId, message: 'El agente empezó a trabajar.' }, 202)
  } catch (err) {
    return handleError(err)
  }
}

export const config: Config = { path: '/api/agent' }
