import type { Config } from '@netlify/functions'
import { requireTeamMember } from '../lib/auth.ts'
import { handleError, HttpError, json } from '../lib/http.ts'
import { logServer, supabaseAdmin } from '../lib/supabaseAdmin.ts'
import { signManual } from '../lib/publisher.ts'

/**
 * POST /api/publish-now { content_id } — solo administradores.
 * Publica YA en Instagram un contenido aprobado (o programado).
 */
export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  try {
    const user = await requireTeamMember(req, { admin: true })
    const { content_id } = (await req.json().catch(() => ({}))) as { content_id?: string }
    if (typeof content_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(content_id)) throw new HttpError(400, 'invalid_input', 'Contenido inválido.')

    const db = supabaseAdmin()
    const { data: ig } = await db.from('integrations').select('status').eq('key', 'instagram').single()
    if (ig?.status !== 'connected') throw new HttpError(409, 'instagram_not_connected', 'Instagram no está conectado.')

    const { data: item } = await db.from('content_items').select('status, title').eq('id', content_id).single()
    if (!item || !['approved', 'scheduled'].includes(item.status))
      throw new HttpError(409, 'not_approved', 'Solo se puede publicar contenido aprobado.')
    const now = new Date().toISOString()
    if (item.status === 'approved') {
      const { error } = await db.from('content_items').update({ status: 'scheduled', scheduled_at: now }).eq('id', content_id).eq('status', 'approved')
      if (error) throw error
    } else {
      await db.from('content_items').update({ scheduled_at: now }).eq('id', content_id).eq('status', 'scheduled')
    }

    const res = await fetch(`${new URL(req.url).origin}/api/publish-run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content_id, sig: signManual(content_id) }),
    })
    if (res.status !== 202 && !res.ok) throw new HttpError(502, 'dispatch_failed', 'No se pudo iniciar la publicación.')
    await logServer('instagram.publish_now', `Publicar ahora: ${item.title}`, { actorId: user.id, entityType: 'content', entityId: content_id })
    return json({ ok: true, message: 'Publicando en Instagram… en un minuto debería aparecer.' }, 202)
  } catch (err) {
    return handleError(err)
  }
}

export const config: Config = { path: '/api/publish-now' }
