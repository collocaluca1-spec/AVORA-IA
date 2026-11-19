import type { Config } from '@netlify/functions'
import { executeQueuedRun } from '../lib/agent/runner.ts'

/**
 * Función en segundo plano (hasta 15 min) que procesa UNA ejecución en cola.
 * No necesita sesión: solo reclama ejecuciones 'queued' recientes creadas por el
 * propio servidor, así que una llamada ajena o repetida no hace nada.
 */
export default async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { run_id?: string }
  if (typeof body.run_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.run_id)) return
  await executeQueuedRun(body.run_id)
}

export const config: Config = { path: '/api/agent-run', background: true }
