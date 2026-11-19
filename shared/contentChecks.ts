import {
  FORMAT_SPECS,
  INSTAGRAM_CAPTION_MAX,
  INSTAGRAM_HASHTAG_MAX,
  type ContentFormat,
} from './content.ts'

/**
 * Controles de calidad y de reglas de negocio de AVORA TRAVEL.
 * Se ejecutan en el Estudio Creativo antes de enviar a aprobación y, más adelante,
 * sobre todo lo que proponga el agente de contenido.
 */

export type CheckLevel = 'error' | 'warning'
export interface CheckResult {
  level: CheckLevel
  code: string
  message: string
}

export interface CheckInput {
  title: string
  caption: string
  hashtags: string[]
  format: ContentFormat
  includes_price: boolean
  price_source_url: string | null
  scheduled_at?: string | null
  assets: { mime_type: string; width: number | null; height: number | null }[]
}

/** Detecta montos que parecen precios: US$ 1.200, $350.000, USD 900, 1500 dólares, ARS 80.000 … */
const PRICE_PATTERN =
  /((US\$|U\$S|USD|ARS|AR\$|\$|€|EUR)\s?\d[\d.,]*)|(\d[\d.,]*\s?(usd|dólares|dolares|pesos|euros)\b)/i

export function mentionsPrice(text: string): boolean {
  return PRICE_PATTERN.test(text)
}

export function isVerifiableUrl(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

export function checkContent(input: CheckInput, opts: { forSubmission: boolean }): CheckResult[] {
  const out: CheckResult[] = []
  const spec = FORMAT_SPECS[input.format]
  const add = (level: CheckLevel, code: string, message: string) => out.push({ level, code, message })
  const submitLevel: CheckLevel = opts.forSubmission ? 'error' : 'warning'

  if (!input.title.trim()) add('error', 'title_required', 'El título es obligatorio.')
  if (input.title.length > 120) add('warning', 'title_long', 'El título supera los 120 caracteres.')

  if (!input.caption.trim()) add(submitLevel, 'caption_required', 'Falta la descripción.')

  const fullCaption = `${input.caption}\n\n${input.hashtags.map((h) => '#' + h).join(' ')}`
  if (fullCaption.length > INSTAGRAM_CAPTION_MAX)
    add('error', 'caption_too_long', `Descripción + hashtags superan los ${INSTAGRAM_CAPTION_MAX} caracteres de Instagram.`)

  if (input.hashtags.length > INSTAGRAM_HASHTAG_MAX)
    add('error', 'too_many_hashtags', `Instagram admite hasta ${INSTAGRAM_HASHTAG_MAX} hashtags.`)
  if (input.hashtags.length === 0) add('warning', 'no_hashtags', 'No hay hashtags.')

  // Regla de negocio: ningún precio sin fuente verificable.
  const priceInText = mentionsPrice(`${input.title} ${input.caption}`)
  if (priceInText && !input.includes_price)
    add('error', 'undeclared_price', 'El texto menciona un precio. Marcá "Incluye precio" y cargá la fuente verificable.')
  if (input.includes_price && !isVerifiableUrl(input.price_source_url))
    add('error', 'price_without_source', 'Los contenidos con precio requieren un enlace verificable a la fuente (proveedor u oferta).')

  // Material visual
  const n = input.assets.length
  if (n < spec.minAssets)
    add(submitLevel, 'assets_missing', spec.minAssets === 1 ? 'Falta el material visual.' : `Un ${spec.label.toLowerCase()} necesita al menos ${spec.minAssets} piezas.`)
  if (n > spec.maxAssets) add('error', 'assets_excess', `Máximo ${spec.maxAssets} pieza(s) para ${spec.label.toLowerCase()}.`)

  for (const a of input.assets) {
    const kind = a.mime_type.startsWith('video/') ? 'video' : a.mime_type.startsWith('image/') ? 'image' : null
    if (!kind || !spec.accepts.includes(kind)) {
      add('error', 'asset_type', `${spec.label}: tipo de archivo no admitido (${a.mime_type}).`)
      continue
    }
    if (a.width && a.height) {
      const expected = spec.width / spec.height
      const actual = a.width / a.height
      if (Math.abs(expected - actual) > 0.02)
        add('warning', 'asset_ratio', `Una pieza mide ${a.width}×${a.height}; el formato espera ${spec.width}×${spec.height}.`)
      else if (a.width < spec.width)
        add('warning', 'asset_resolution', `Una pieza tiene ${a.width}px de ancho; se recomienda ${spec.width}px.`)
    }
  }

  if (input.scheduled_at && new Date(input.scheduled_at).getTime() < Date.now())
    add('warning', 'schedule_past', 'La fecha programada ya pasó.')

  return out
}

export const hasBlockingErrors = (r: CheckResult[]) => r.some((c) => c.level === 'error')
