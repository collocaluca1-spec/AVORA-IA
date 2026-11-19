/**
 * Modelo de dominio compartido entre el frontend y las funciones de servidor.
 * Los valores deben coincidir con los enums de supabase/migrations.
 */

export const CONTENT_FORMATS = [
  'post_portrait',
  'post_square',
  'story',
  'reel',
  'carousel',
] as const
export type ContentFormat = (typeof CONTENT_FORMATS)[number]

export interface FormatSpec {
  id: ContentFormat
  label: string
  shortLabel: string
  width: number
  height: number
  /** Tipos MIME aceptados para el material visual */
  accepts: ('image' | 'video')[]
  minAssets: number
  maxAssets: number
  description: string
}

export const FORMAT_SPECS: Record<ContentFormat, FormatSpec> = {
  post_portrait: {
    id: 'post_portrait',
    label: 'Publicación vertical',
    shortLabel: 'Post 4:5',
    width: 1080,
    height: 1350,
    accepts: ['image'],
    minAssets: 1,
    maxAssets: 1,
    description: 'Publicación individual de feed, formato recomendado por Instagram.',
  },
  post_square: {
    id: 'post_square',
    label: 'Publicación cuadrada',
    shortLabel: 'Post 1:1',
    width: 1080,
    height: 1080,
    accepts: ['image'],
    minAssets: 1,
    maxAssets: 1,
    description: 'Imagen cuadrada clásica para el feed.',
  },
  story: {
    id: 'story',
    label: 'Historia',
    shortLabel: 'Historia',
    width: 1080,
    height: 1920,
    accepts: ['image', 'video'],
    minAssets: 1,
    maxAssets: 1,
    description: 'Contenido vertical efímero de 24 horas.',
  },
  reel: {
    id: 'reel',
    label: 'Reel',
    shortLabel: 'Reel',
    width: 1080,
    height: 1920,
    accepts: ['video'],
    minAssets: 1,
    maxAssets: 1,
    description: 'Video vertical para Reels.',
  },
  carousel: {
    id: 'carousel',
    label: 'Carrusel',
    shortLabel: 'Carrusel',
    width: 1080,
    height: 1350,
    accepts: ['image', 'video'],
    minAssets: 2,
    maxAssets: 10,
    description: 'Entre 2 y 10 piezas deslizables, 1080 × 1350.',
  },
}

export const CONTENT_STATUSES = [
  'draft',
  'generating',
  'pending_approval',
  'approved',
  'scheduled',
  'publishing',
  'published',
  'error',
  'rejected',
] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

export const STATUS_LABELS: Record<ContentStatus, string> = {
  draft: 'Borrador',
  generating: 'Generando',
  pending_approval: 'Pendiente de aprobación',
  approved: 'Aprobado',
  scheduled: 'Programado',
  publishing: 'Publicando',
  published: 'Publicado',
  error: 'Error',
  rejected: 'Rechazado',
}

export type ContentOrigin = 'manual' | 'agent'

export interface ContentItem {
  id: string
  title: string
  caption: string
  hashtags: string[]
  format: ContentFormat
  status: ContentStatus
  origin: ContentOrigin
  destination: string | null
  topic_key: string | null
  notes: string | null
  /** Fuentes consultadas por el agente */
  sources?: { url: string; title: string }[]
  scheduled_at: string | null
  published_at: string | null
  includes_price: boolean
  price_source_url: string | null
  price_source_note: string | null
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  error_message: string | null
  instagram_media_id: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface ContentAsset {
  id: string
  content_id: string
  storage_path: string
  mime_type: string
  width: number | null
  height: number | null
  duration_seconds: number | null
  position: number
  alt_text: string | null
  source: 'upload' | 'ai' | 'stock'
  /** Crédito del autor para material de banco (Pexels) */
  credit?: { provider: string; author: string; author_url: string; page_url: string } | null
  created_at: string
}

export const INSTAGRAM_CAPTION_MAX = 2200
export const INSTAGRAM_HASHTAG_MAX = 30

/** Normaliza hashtags: quita '#', espacios y duplicados (sin distinguir mayúsculas). */
export function normalizeHashtags(input: string | string[]): string[] {
  const raw = Array.isArray(input) ? input : input.split(/[\s,]+/)
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of raw) {
    const tag = r.trim().replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '')
    if (!tag) continue
    const key = tag.toLocaleLowerCase('es')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tag)
  }
  return out
}
