/**
 * Fotos y videos reales de Pexels (https://www.pexels.com/api/).
 * La clave vive solo en el servidor (PEXELS_API_KEY). Cada archivo guarda el
 * crédito del autor, como pide Pexels.
 */
import type { ContentFormat } from '../../../shared/content.ts'

export interface StockMedia {
  provider: 'pexels'
  provider_id: string
  kind: 'image' | 'video'
  download_url: string
  width: number
  height: number
  duration_seconds?: number
  author: string
  author_url: string
  page_url: string
  alt: string
}

const API = 'https://api.pexels.com'

export function pexelsKey(): string | null {
  return process.env.PEXELS_API_KEY?.trim() || null
}

const DIMENSIONS: Record<ContentFormat, { w: number; h: number }> = {
  post_portrait: { w: 1080, h: 1350 },
  post_square: { w: 1080, h: 1080 },
  carousel: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
  reel: { w: 1080, h: 1920 },
}

async function call(path: string, key: string): Promise<any> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: key } })
  if (res.status === 401 || res.status === 403) throw new Error('Pexels rechazó la clave (PEXELS_API_KEY).')
  if (!res.ok) throw new Error(`Pexels respondió ${res.status}.`)
  return res.json()
}

/** Comprobación real de la clave. */
export async function verifyPexels(key: string): Promise<void> {
  await call('/v1/curated?per_page=1', key)
}

/** Busca fotos para un formato. Devuelve hasta `count` fotos no usadas antes. */
export async function findPhotos(query: string, format: ContentFormat, count: number, exclude: Set<string>, key: string): Promise<StockMedia[]> {
  const orientation = format === 'post_square' ? 'square' : 'portrait'
  const data = await call(`/v1/search?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=30`, key)
  const { w, h } = DIMENSIONS[format]
  const out: StockMedia[] = []
  for (const p of data.photos ?? []) {
    const id = `photo:${p.id}`
    if (exclude.has(id) || !p.src?.original) continue
    // Pexels sirve la foto recortada al tamaño exacto de Instagram.
    const sep = p.src.original.includes('?') ? '&' : '?'
    out.push({
      provider: 'pexels',
      provider_id: id,
      kind: 'image',
      download_url: `${p.src.original}${sep}auto=compress&cs=tinysrgb&fit=crop&w=${w}&h=${h}`,
      width: w,
      height: h,
      author: p.photographer ?? 'Pexels',
      author_url: p.photographer_url ?? 'https://www.pexels.com',
      page_url: p.url ?? 'https://www.pexels.com',
      alt: p.alt ?? query,
    })
    if (out.length >= count) break
  }
  return out
}

/** Busca un video vertical (para Reels) de hasta 60 s y menos de ~45 MB. */
export async function findVerticalVideo(query: string, exclude: Set<string>, key: string): Promise<StockMedia | null> {
  const data = await call(`/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=30`, key)
  for (const v of data.videos ?? []) {
    const id = `video:${v.id}`
    if (exclude.has(id) || !(v.duration > 0 && v.duration <= 60)) continue
    const files = (v.video_files ?? [])
      .filter((f: any) => f.file_type === 'video/mp4' && f.height > f.width && f.width >= 720 && f.width <= 1440)
      .sort((a: any, b: any) => Math.abs(a.width - 1080) - Math.abs(b.width - 1080))
    const f = files[0]
    if (!f) continue
    return {
      provider: 'pexels',
      provider_id: id,
      kind: 'video',
      download_url: f.link,
      width: f.width,
      height: f.height,
      duration_seconds: v.duration,
      author: v.user?.name ?? 'Pexels',
      author_url: v.user?.url ?? 'https://www.pexels.com',
      page_url: v.url ?? 'https://www.pexels.com',
      alt: query,
    }
  }
  return null
}

export const MAX_DOWNLOAD_BYTES = 45 * 1024 * 1024

export async function download(media: StockMedia): Promise<{ bytes: ArrayBuffer; mime: string }> {
  const res = await fetch(media.download_url)
  if (!res.ok) throw new Error(`No se pudo descargar el archivo de Pexels (${res.status}).`)
  const len = Number(res.headers.get('content-length') ?? 0)
  if (len > MAX_DOWNLOAD_BYTES) throw new Error('El archivo es demasiado pesado.')
  const bytes = await res.arrayBuffer()
  if (bytes.byteLength > MAX_DOWNLOAD_BYTES) throw new Error('El archivo es demasiado pesado.')
  const mime = media.kind === 'video' ? 'video/mp4' : (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0]
  return { bytes, mime: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'].includes(mime) ? mime : 'image/jpeg' }
}
