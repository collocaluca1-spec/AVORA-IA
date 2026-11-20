/**
 * Banco de fotos y videos reales. Usa Pixabay (PIXABAY_API_KEY) o Pexels
 * (PEXELS_API_KEY), el que esté configurado. Las claves viven solo en el servidor.
 * Las fotos se recortan al tamaño exacto de cada formato de Instagram y cada
 * archivo guarda el crédito del autor.
 */
import sharp from 'sharp'
import type { ContentFormat } from '../../../shared/content.ts'

export interface StockMedia {
  provider: 'pixabay' | 'pexels'
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

export interface StockProvider {
  name: 'pixabay' | 'pexels'
  verify(): Promise<void>
  findPhotos(query: string, format: ContentFormat, count: number, exclude: Set<string>): Promise<StockMedia[]>
  findVerticalVideo(query: string, exclude: Set<string>): Promise<StockMedia | null>
}

export const DIMENSIONS: Record<ContentFormat, { w: number; h: number }> = {
  post_portrait: { w: 1080, h: 1350 },
  post_square: { w: 1080, h: 1080 },
  carousel: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
  reel: { w: 1080, h: 1920 },
}

async function getJSON(url: string, init: RequestInit, label: string): Promise<any> {
  const res = await fetch(url, init)
  if (res.status === 400 || res.status === 401 || res.status === 403) throw new Error(`${label} rechazó la clave.`)
  if (!res.ok) throw new Error(`${label} respondió ${res.status}.`)
  return res.json()
}

// ─── Pixabay ─────────────────────────────────────────────────────────
function pixabay(key: string): StockProvider {
  const base = 'https://pixabay.com/api/'
  const q = (params: Record<string, string>) =>
    new URLSearchParams({ key, safesearch: 'true', per_page: '40', ...params }).toString()

  return {
    name: 'pixabay',
    async verify() {
      await getJSON(`${base}?${q({ q: 'travel', per_page: '3' })}`, {}, 'Pixabay')
    },
    async findPhotos(query, format, count, exclude) {
      const orientation = format === 'post_square' ? 'all' : 'vertical'
      const data = await getJSON(`${base}?${q({ q: query, image_type: 'photo', orientation, order: 'popular' })}`, {}, 'Pixabay')
      const out: StockMedia[] = []
      for (const h of data.hits ?? []) {
        const id = `pixabay:photo:${h.id}`
        if (exclude.has(id) || !h.largeImageURL) continue
        out.push({
          provider: 'pixabay',
          provider_id: id,
          kind: 'image',
          download_url: h.largeImageURL,
          width: h.imageWidth,
          height: h.imageHeight,
          author: h.user ?? 'Pixabay',
          author_url: h.user_id ? `https://pixabay.com/users/${encodeURIComponent(h.user)}-${h.user_id}/` : 'https://pixabay.com',
          page_url: h.pageURL ?? 'https://pixabay.com',
          alt: h.tags ?? query,
        })
        if (out.length >= count) break
      }
      return out
    },
    async findVerticalVideo(query, exclude) {
      const data = await getJSON(`${base}videos/?${q({ q: query })}`, {}, 'Pixabay')
      for (const v of data.hits ?? []) {
        const id = `pixabay:video:${v.id}`
        if (exclude.has(id) || !(v.duration > 0 && v.duration <= 60)) continue
        const files = Object.values(v.videos ?? {}) as { url: string; width: number; height: number; size: number }[]
        const f = files
          .filter((x) => x?.url && x.height > x.width && x.width >= 720 && x.size < MAX_DOWNLOAD_BYTES)
          .sort((a, b) => Math.abs(a.width - 1080) - Math.abs(b.width - 1080))[0]
        if (!f) continue
        return {
          provider: 'pixabay',
          provider_id: id,
          kind: 'video',
          download_url: f.url,
          width: f.width,
          height: f.height,
          duration_seconds: v.duration,
          author: v.user ?? 'Pixabay',
          author_url: v.user_id ? `https://pixabay.com/users/${encodeURIComponent(v.user)}-${v.user_id}/` : 'https://pixabay.com',
          page_url: v.pageURL ?? 'https://pixabay.com',
          alt: v.tags ?? query,
        }
      }
      return null
    },
  }
}

// ─── Pexels ──────────────────────────────────────────────────────────
function pexels(key: string): StockProvider {
  const api = 'https://api.pexels.com'
  const init = { headers: { Authorization: key } }
  return {
    name: 'pexels',
    async verify() {
      await getJSON(`${api}/v1/curated?per_page=1`, init, 'Pexels')
    },
    async findPhotos(query, format, count, exclude) {
      const orientation = format === 'post_square' ? 'square' : 'portrait'
      const data = await getJSON(`${api}/v1/search?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=30`, init, 'Pexels')
      const out: StockMedia[] = []
      for (const p of data.photos ?? []) {
        const id = `photo:${p.id}`
        if (exclude.has(id) || !p.src?.large2x) continue
        out.push({
          provider: 'pexels',
          provider_id: id,
          kind: 'image',
          download_url: p.src.large2x,
          width: p.width,
          height: p.height,
          author: p.photographer ?? 'Pexels',
          author_url: p.photographer_url ?? 'https://www.pexels.com',
          page_url: p.url ?? 'https://www.pexels.com',
          alt: p.alt || query,
        })
        if (out.length >= count) break
      }
      return out
    },
    async findVerticalVideo(query, exclude) {
      const data = await getJSON(`${api}/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=30`, init, 'Pexels')
      for (const v of data.videos ?? []) {
        const id = `video:${v.id}`
        if (exclude.has(id) || !(v.duration > 0 && v.duration <= 60)) continue
        const f = (v.video_files ?? [])
          .filter((x: any) => x.file_type === 'video/mp4' && x.height > x.width && x.width >= 720 && x.width <= 1440)
          .sort((a: any, b: any) => Math.abs(a.width - 1080) - Math.abs(b.width - 1080))[0]
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
    },
  }
}

/** El banco configurado (Pixabay tiene prioridad), o null si no hay ninguno. */
export function resolveStockProvider(): StockProvider | null {
  const pix = process.env.PIXABAY_API_KEY?.trim()
  if (pix) return pixabay(pix)
  const pex = process.env.PEXELS_API_KEY?.trim()
  if (pex) return pexels(pex)
  return null
}

export const MAX_DOWNLOAD_BYTES = 45 * 1024 * 1024

/**
 * Descarga el archivo. Las fotos se recortan (centrado inteligente) al tamaño
 * exacto del formato y se guardan como JPEG; los videos se guardan tal cual.
 */
export async function downloadFor(
  media: StockMedia,
  format: ContentFormat,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; mime: string; width: number; height: number }> {
  const res = await fetch(media.download_url)
  if (!res.ok) throw new Error(`No se pudo descargar el archivo (${res.status}).`)
  const len = Number(res.headers.get('content-length') ?? 0)
  if (len > MAX_DOWNLOAD_BYTES) throw new Error('El archivo es demasiado pesado.')
  const raw = new Uint8Array(await res.arrayBuffer())
  if (raw.byteLength > MAX_DOWNLOAD_BYTES) throw new Error('El archivo es demasiado pesado.')

  if (media.kind === 'video') return { bytes: raw, mime: 'video/mp4', width: media.width, height: media.height }

  const { w, h } = DIMENSIONS[format]
  const out = await sharp(raw)
    .rotate()
    .resize(w, h, { fit: 'cover', position: sharp.strategy.attention })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer()
  return { bytes: new Uint8Array(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer), mime: 'image/jpeg', width: w, height: h }
}
