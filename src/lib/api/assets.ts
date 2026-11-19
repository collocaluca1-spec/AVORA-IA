import { db, MEDIA_BUCKET } from '../supabase'
import type { ContentAsset } from '@shared/content'

export interface LocalMedia {
  file: File
  previewUrl: string
  width: number | null
  height: number | null
  duration: number | null
  mime: string
}

/** Lee dimensiones reales del archivo en el navegador (sin subirlo). */
export async function inspectFile(file: File): Promise<LocalMedia> {
  const previewUrl = URL.createObjectURL(file)
  const base = { file, previewUrl, mime: file.type, width: null, height: null, duration: null }
  try {
    if (file.type.startsWith('image/')) {
      const img = new Image()
      img.src = previewUrl
      await img.decode()
      return { ...base, width: img.naturalWidth, height: img.naturalHeight }
    }
    if (file.type.startsWith('video/')) {
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.src = previewUrl
      await new Promise<void>((res, rej) => {
        v.onloadedmetadata = () => res()
        v.onerror = () => rej(new Error('No se pudo leer el video'))
      })
      return { ...base, width: v.videoWidth, height: v.videoHeight, duration: Math.round(v.duration * 100) / 100 }
    }
  } catch {
    /* dimensiones desconocidas */
  }
  return base
}

export async function uploadAsset(contentId: string, media: LocalMedia, position: number): Promise<ContentAsset> {
  const ext = media.file.name.split('.').pop()?.toLowerCase() || 'bin'
  const path = `content/${contentId}/${crypto.randomUUID()}.${ext}`
  const up = await db().storage.from(MEDIA_BUCKET).upload(path, media.file, {
    contentType: media.mime,
    upsert: false,
  })
  if (up.error) throw up.error
  const { data, error } = await db()
    .from('content_assets')
    .insert({
      content_id: contentId,
      storage_path: path,
      mime_type: media.mime,
      width: media.width,
      height: media.height,
      duration_seconds: media.duration,
      position,
      source: 'upload',
    })
    .select()
    .single()
  if (error) {
    await db().storage.from(MEDIA_BUCKET).remove([path])
    throw error
  }
  return data as ContentAsset
}

export async function removeAsset(asset: ContentAsset): Promise<void> {
  const { error } = await db().from('content_assets').delete().eq('id', asset.id)
  if (error) throw error
  await db().storage.from(MEDIA_BUCKET).remove([asset.storage_path])
}

export async function reorderAssets(ordered: { id: string }[]): Promise<void> {
  for (let i = 0; i < ordered.length; i++) {
    const { error } = await db().from('content_assets').update({ position: i }).eq('id', ordered[i].id)
    if (error) throw error
  }
}

// ─── URLs firmadas con caché (el bucket es privado) ────────────────
const cache = new Map<string, { url: string; expires: number }>()
const TTL_SECONDS = 60 * 60

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now()
  const out: Record<string, string> = {}
  const missing: string[] = []
  for (const p of paths) {
    const c = cache.get(p)
    if (c && c.expires > now + 60_000) out[p] = c.url
    else missing.push(p)
  }
  if (missing.length) {
    const { data, error } = await db().storage.from(MEDIA_BUCKET).createSignedUrls(missing, TTL_SECONDS)
    if (error) throw error
    for (const d of data ?? []) {
      if (d.signedUrl && d.path) {
        cache.set(d.path, { url: d.signedUrl, expires: now + TTL_SECONDS * 1000 })
        out[d.path] = d.signedUrl
      }
    }
  }
  return out
}
