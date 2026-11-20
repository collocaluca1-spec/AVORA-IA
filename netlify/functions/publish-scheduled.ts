import type { Config } from '@netlify/functions'
import { autoPublishReady, dueItems } from '../lib/publisher.ts'
import { refreshToken } from '../lib/instagram.ts'
import { logServer } from '../lib/supabaseAdmin.ts'

/**
 * Cada 10 minutos: si la publicación automática está activa, publica lo aprobado
 * cuya fecha llegó (cada publicación corre en segundo plano, los videos tardan).
 * También renueva el permiso de Instagram una vez por semana.
 */
export default async () => {
  try {
    await refreshToken().catch((e) =>
      logServer('instagram.refresh_failed', 'No se pudo renovar el permiso de Instagram', { level: 'warning', details: { message: String(e?.message ?? e) } }),
    )
    if (!(await autoPublishReady())) return
    const site = process.env.URL
    if (!site) return
    for (const id of await dueItems()) {
      await fetch(`${site}/api/publish-run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content_id: id }) })
    }
  } catch (err) {
    await logServer('instagram.schedule_failed', 'Falló la revisión de publicaciones programadas', { level: 'error', details: { message: err instanceof Error ? err.message : String(err) } })
  }
}

export const config: Config = { schedule: '*/10 * * * *' }
