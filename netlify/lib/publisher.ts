/**
 * Publicación automática: toma contenido APROBADO cuya fecha llegó y lo publica
 * en Instagram. Nunca publica nada que no haya aprobado un administrador.
 */
import { logServer, supabaseAdmin } from './supabaseAdmin.ts'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { getAccount, publishItem } from './instagram.ts'

/** Firma de corta duración para "Publicar ahora" (la genera solo el servidor). */
export function signManual(contentId: string, at = Date.now()): string {
  const minute = Math.floor(at / 60_000)
  return `${minute}.${createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').update(`${contentId}:${minute}`).digest('hex')}`
}
export function verifyManual(contentId: string, sig: unknown): boolean {
  if (typeof sig !== 'string' || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false
  const minute = Number(sig.split('.')[0])
  if (!Number.isFinite(minute) || Math.abs(Date.now() / 60_000 - minute) > 5) return false
  const expected = Buffer.from(signManual(contentId, minute * 60_000))
  const got = Buffer.from(sig)
  return expected.length === got.length && timingSafeEqual(expected, got)
}

/** ¿Está activa la publicación automática y conectado Instagram? */
export async function autoPublishReady(): Promise<boolean> {
  const db = supabaseAdmin()
  const [{ data: auto }, { data: ig }] = await Promise.all([
    db.from('app_settings').select('value').eq('key', 'automations').single(),
    db.from('integrations').select('status').eq('key', 'instagram').single(),
  ])
  return Boolean(auto?.value?.auto_publish_enabled) && ig?.status === 'connected'
}

/**
 * Pasa a "Programado" lo aprobado que tiene fecha, y devuelve los ids de lo
 * programado cuya hora ya llegó (hasta 6 por ronda).
 */
export async function dueItems(now = new Date()): Promise<string[]> {
  const db = supabaseAdmin()
  const { data: approved } = await db.from('content_items').select('id').eq('status', 'approved').not('scheduled_at', 'is', null)
  for (const a of approved ?? []) await db.from('content_items').update({ status: 'scheduled' }).eq('id', a.id).eq('status', 'approved')

  const { data: due } = await db
    .from('content_items')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now.toISOString())
    .order('scheduled_at')
    .limit(6)
  return (due ?? []).map((d) => d.id as string)
}

/** Publica un contenido programado. Lo reclama de forma atómica (no se publica dos veces). */
export async function publishOne(contentId: string, opts: { manual?: boolean } = {}): Promise<void> {
  const db = supabaseAdmin()
  const { data: item } = await db
    .from('content_items')
    .update({ status: 'publishing', publish_started_at: new Date().toISOString() })
    .eq('id', contentId)
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .select('id, title, format, caption, hashtags, publish_attempts')
    .maybeSingle()
  if (!item) return

  try {
    if (!opts.manual && !(await autoPublishReady())) throw new Error('La publicación automática está desactivada o Instagram no está conectado.')
    const acc = await getAccount()
    if (!acc) throw new Error('Instagram no está conectado.')
    const { data: assets } = await db.from('content_assets').select('storage_path, mime_type, position').eq('content_id', contentId)
    const mediaId = await publishItem(acc, { ...item, assets: assets ?? [] })
    await db
      .from('content_items')
      .update({ status: 'published', published_at: new Date().toISOString(), instagram_media_id: mediaId, error_message: null, publish_attempts: item.publish_attempts + 1 })
      .eq('id', contentId)
    await logServer('instagram.published', `Publicado en Instagram: ${item.title}`, { entityType: 'content', entityId: contentId, details: { media_id: mediaId } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db
      .from('content_items')
      .update({ status: 'error', error_message: message, publish_attempts: item.publish_attempts + 1 })
      .eq('id', contentId)
    await logServer('instagram.publish_failed', `No se pudo publicar: ${item.title}`, { level: 'error', entityType: 'content', entityId: contentId, details: { message } })
  }
}
