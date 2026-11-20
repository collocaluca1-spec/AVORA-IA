import type { Config } from '@netlify/functions'
import { publishOne } from '../lib/publisher.ts'

/**
 * Segundo plano (hasta 15 min): publica UN contenido. No necesita sesión: solo
 * actúa sobre contenido aprobado y programado cuya hora ya llegó, y lo reclama
 * de forma atómica, así que una llamada ajena o repetida no hace nada.
 */
export default async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { content_id?: string }
  if (typeof body.content_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.content_id)) return
  await publishOne(body.content_id)
}

export const config: Config = { path: '/api/publish-run', background: true }
