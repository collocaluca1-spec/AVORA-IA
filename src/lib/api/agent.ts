import { db } from '../supabase'

export type AgentTask = 'research_destination' | 'propose_ideas' | 'write_copy' | 'travel_tips' | 'seasonal_recommendations'

export async function runAgent(task: AgentTask, input: Record<string, unknown>): Promise<{ ok: boolean; message: string; data?: unknown }> {
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
  return { ok: res.ok, message: body.message ?? (res.ok ? 'Listo.' : 'Error'), data: body }
}
