import type { Config } from '@netlify/functions'
import { requireTeamMember } from '../lib/auth.ts'
import { handleError, HttpError, json } from '../lib/http.ts'
import { runAgentTask } from '../lib/agent/runner.ts'
import { AGENT_TASKS, type AgentTask } from '../lib/agent/tasks.ts'

/** POST /api/agent  { task, input }  → ejecuta una tarea del agente de contenido. */
export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  try {
    const user = await requireTeamMember(req)
    const body = (await req.json().catch(() => ({}))) as { task?: string; input?: Record<string, unknown> }
    if (!body.task || !AGENT_TASKS.includes(body.task as AgentTask))
      throw new HttpError(400, 'invalid_task', 'Tarea desconocida.')
    const result = await runAgentTask(body.task as AgentTask, body.input ?? {}, user.id)
    return json({ ok: true, ...result })
  } catch (err) {
    return handleError(err)
  }
}

export const config: Config = { path: '/api/agent' }
