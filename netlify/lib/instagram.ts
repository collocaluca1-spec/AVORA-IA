/**
 * Instagram API con inicio de sesión de Instagram (cuentas profesionales, sin
 * página de Facebook). https://developers.facebook.com/docs/instagram-platform
 *
 * El token inicial se carga en Netlify (INSTAGRAM_ACCESS_TOKEN). Al verificarlo
 * se guarda en `integration_tokens` (solo servidor) y desde ahí se renueva solo
 * antes de que venza (dura 60 días).
 */
import { supabaseAdmin } from './supabaseAdmin.ts'

const GRAPH = 'https://graph.instagram.com'
const MEDIA_BUCKET = 'content-media'

export interface IgAccount {
  token: string
  accountId: string
  username: string | null
}

async function ig(path: string, token: string, init: { method?: 'GET' | 'POST'; params?: Record<string, string> } = {}): Promise<any> {
  const params = new URLSearchParams({ ...(init.params ?? {}), access_token: token })
  const method = init.method ?? 'GET'
  const url = method === 'GET' ? `${GRAPH}${path}?${params}` : `${GRAPH}${path}`
  const res = await fetch(url, method === 'POST' ? { method, body: params } : undefined)
  const body: any = await res.json().catch(() => ({}))
  if (!res.ok || body.error) {
    const msg = body.error?.error_user_msg || body.error?.message || `Instagram respondió ${res.status}`
    const err = new Error(`Instagram: ${msg}`) as Error & { code?: number; status?: number }
    err.code = body.error?.code
    err.status = res.status
    throw err
  }
  return body
}

/** Comprueba un token contra Instagram y lo guarda para el servidor. */
export async function verifyAndStore(token: string): Promise<IgAccount> {
  const me = await ig('/me', token, { params: { fields: 'user_id,username,account_type' } })
  if (me.account_type && !['BUSINESS', 'MEDIA_CREATOR'].includes(me.account_type))
    throw new Error('La cuenta de Instagram no es profesional (empresa o creador).')
  const accountId = String(me.user_id ?? me.id)
  await supabaseAdmin().from('integration_tokens').upsert({
    key: 'instagram',
    token,
    account_id: accountId,
    username: me.username ?? null,
    expires_at: new Date(Date.now() + 60 * 86_400_000).toISOString(),
    updated_at: new Date().toISOString(),
  })
  return { token, accountId, username: me.username ?? null }
}

/**
 * Verificación desde Configuración: primero el token guardado (puede estar
 * renovado); si falta o ya no sirve, el de Netlify (INSTAGRAM_ACCESS_TOKEN).
 */
export async function verifyConnection(): Promise<IgAccount | null> {
  const db = supabaseAdmin()
  const { data } = await db.from('integration_tokens').select('token').eq('key', 'instagram').maybeSingle()
  const envToken = process.env.INSTAGRAM_ACCESS_TOKEN?.trim()
  if (data?.token) {
    try {
      return await verifyAndStoreKeepingExpiry(data.token)
    } catch (e) {
      if (!envToken || envToken === data.token) throw e
    }
  }
  return envToken ? verifyAndStore(envToken) : null
}

async function verifyAndStoreKeepingExpiry(token: string): Promise<IgAccount> {
  const me = await ig('/me', token, { params: { fields: 'user_id,username' } })
  const acc = { token, accountId: String(me.user_id ?? me.id), username: me.username ?? null }
  await supabaseAdmin().from('integration_tokens').update({ account_id: acc.accountId, username: acc.username }).eq('key', 'instagram')
  return acc
}

/** Cuenta conectada: primero el token guardado (renovado), si no el del entorno. */
export async function getAccount(): Promise<IgAccount | null> {
  const db = supabaseAdmin()
  const { data } = await db.from('integration_tokens').select('token, account_id, username').eq('key', 'instagram').maybeSingle()
  if (data?.token && data.account_id) return { token: data.token, accountId: data.account_id, username: data.username }
  const envToken = process.env.INSTAGRAM_ACCESS_TOKEN?.trim()
  return envToken ? verifyAndStore(envToken) : null
}

/** Renueva el token de larga duración (debe tener al menos 24 h). */
export async function refreshToken(): Promise<boolean> {
  const db = supabaseAdmin()
  const { data } = await db.from('integration_tokens').select('token, updated_at, refreshed_at').eq('key', 'instagram').maybeSingle()
  if (!data?.token) return false
  const last = new Date(data.refreshed_at ?? data.updated_at).getTime()
  if (Date.now() - last < 7 * 86_400_000) return false // una vez por semana alcanza
  const r = await ig('/refresh_access_token', data.token, { params: { grant_type: 'ig_refresh_token' } })
  await db
    .from('integration_tokens')
    .update({
      token: r.access_token,
      expires_at: new Date(Date.now() + Number(r.expires_in ?? 5_184_000) * 1000).toISOString(),
      refreshed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('key', 'instagram')
  return true
}

// ─── Publicación ─────────────────────────────────────────────────────

export interface PublishableItem {
  id: string
  format: 'post_portrait' | 'post_square' | 'story' | 'reel' | 'carousel'
  caption: string
  hashtags: string[]
  assets: { storage_path: string; mime_type: string; position: number }[]
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function buildCaption(caption: string, hashtags: string[]): string {
  const tags = hashtags.map((h) => `#${h.replace(/^#+/, '')}`).join(' ')
  const text = tags ? `${caption.trim()}\n\n${tags}` : caption.trim()
  return text.slice(0, 2200)
}

async function signedUrl(path: string): Promise<string> {
  const { data, error } = await supabaseAdmin().storage.from(MEDIA_BUCKET).createSignedUrl(path, 2 * 3600)
  if (error || !data?.signedUrl) throw new Error('No se pudo preparar el archivo para Instagram.')
  return data.signedUrl
}

/** Espera a que Instagram termine de procesar un contenedor (videos sobre todo). */
async function waitReady(containerId: string, token: string, maxMs = 8 * 60_000) {
  const until = Date.now() + maxMs
  while (Date.now() < until) {
    const s = await ig(`/${containerId}`, token, { params: { fields: 'status_code,status' } })
    if (s.status_code === 'FINISHED') return
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error(`Instagram no pudo procesar el archivo (${s.status ?? s.status_code}).`)
    await sleep(5000)
  }
  throw new Error('Instagram tardó demasiado en procesar el archivo.')
}

async function container(acc: IgAccount, params: Record<string, string>): Promise<string> {
  const r = await ig(`/${acc.accountId}/media`, acc.token, { method: 'POST', params })
  return r.id as string
}

/** Publica un contenido aprobado. Devuelve el id de la publicación en Instagram. */
export async function publishItem(acc: IgAccount, item: PublishableItem): Promise<string> {
  const assets = [...item.assets].sort((a, b) => a.position - b.position)
  if (!assets.length) throw new Error('El contenido no tiene imagen ni video.')
  const caption = buildCaption(item.caption, item.hashtags)
  const isVideo = (a: { mime_type: string }) => a.mime_type.startsWith('video/')
  const mediaParam = async (a: (typeof assets)[number]): Promise<Record<string, string>> =>
    isVideo(a) ? { video_url: await signedUrl(a.storage_path) } : { image_url: await signedUrl(a.storage_path) }

  let creationId: string
  if (item.format === 'carousel') {
    const children: string[] = []
    for (const a of assets.slice(0, 10)) {
      const params: Record<string, string> = { is_carousel_item: 'true', ...(await mediaParam(a)) }
      if (isVideo(a)) params.media_type = 'VIDEO'
      const id = await container(acc, params)
      await waitReady(id, acc.token)
      children.push(id)
    }
    if (children.length < 2) throw new Error('Un carrusel necesita al menos 2 imágenes.')
    creationId = await container(acc, { media_type: 'CAROUSEL', children: children.join(','), caption })
  } else if (item.format === 'reel') {
    const v = assets.find(isVideo)
    if (!v) throw new Error('El reel no tiene video.')
    creationId = await container(acc, { media_type: 'REELS', video_url: await signedUrl(v.storage_path), caption, share_to_feed: 'true' })
  } else if (item.format === 'story') {
    creationId = await container(acc, { media_type: 'STORIES', ...(await mediaParam(assets[0])) } as Record<string, string>)
  } else {
    const img = assets.find((a) => !isVideo(a))
    if (!img) throw new Error('La publicación necesita una imagen.')
    creationId = await container(acc, { image_url: await signedUrl(img.storage_path), caption })
  }

  await waitReady(creationId, acc.token)
  const published = await ig(`/${acc.accountId}/media_publish`, acc.token, { method: 'POST', params: { creation_id: creationId } })
  return String(published.id)
}
