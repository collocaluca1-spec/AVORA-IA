/**
 * Planificación semanal automática: el agente arma la semana siguiente según la
 * frecuencia configurada. Cada pieza queda en "Pendiente de aprobación" con
 * fecha, texto, hashtags, fuentes y material visual real (Pexels).
 * Nada se publica sin la aprobación de un administrador.
 */
import { FORMAT_SPECS, INSTAGRAM_CAPTION_MAX, INSTAGRAM_HASHTAG_MAX, normalizeHashtags, type ContentFormat } from '../../../shared/content.ts'
import { mentionsPrice } from '../../../shared/contentChecks.ts'
import { repetitionReason } from '../../../shared/agent/dedupe.ts'
import { nextMonday, weekSlots, zonedToUtc, type Slot } from '../../../shared/agent/weekSlots.ts'
import { logServer, supabaseAdmin } from '../supabaseAdmin.ts'
import { download, findPhotos, findVerticalVideo, pexelsKey, type StockMedia } from '../media/pexels.ts'
import { loadBrandContext } from './brandContext.ts'
import { resolveTextProvider } from './providers.ts'

const MEDIA_BUCKET = 'content-media'

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || null

interface Piece {
  slot: number
  title: string
  destination: string
  angle: string
  caption: string
  hashtags: string[]
  media_queries: string[]
  alt_text: string
  sources: { url: string; title: string }[]
}

const SCHEMA_HINT = `{ "pieces": [{ "slot": number, "title": string, "destination": string, "angle": string, "caption": string, "hashtags": string[], "media_queries": string[], "alt_text": string, "sources": [{ "url": string, "title": string }] }] }`

function formatLine(s: Slot, i: number) {
  const spec = FORMAT_SPECS[s.format]
  return `${i + 1}. ${spec.label} · ${s.localDate} ${s.localTime}`
}

export async function runWeekPlan(runId: string, input: Record<string, unknown>, userId: string | null) {
  const { provider } = resolveTextProvider()
  if (!provider) throw new Error('La IA de texto no está configurada en el servidor.')
  const db = supabaseAdmin()

  const { data: settings } = await db.from('app_settings').select('key, value').in('key', ['publishing_frequency', 'brand_identity'])
  const get = (k: string) => (settings?.find((r) => r.key === k)?.value ?? {}) as Record<string, any>
  const freq = get('publishing_frequency')
  const brand = get('brand_identity')
  const timeZone: string = freq.timezone || 'America/Argentina/Buenos_Aires'

  const weekStart = typeof input.week_start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.week_start) ? input.week_start : nextMonday(new Date(), timeZone)
  const from = zonedToUtc(weekStart, '00:00', timeZone)
  const to = new Date(from.getTime() + 7 * 86_400_000)

  // Lo que ya está planificado esa semana se descuenta (re-ejecutar no duplica).
  const { data: existingRows } = await db
    .from('content_items')
    .select('format')
    .gte('scheduled_at', from.toISOString())
    .lt('scheduled_at', to.toISOString())
    .neq('status', 'rejected')
  const existing: Partial<Record<ContentFormat, number>> = {}
  for (const r of existingRows ?? []) existing[r.format as ContentFormat] = (existing[r.format as ContentFormat] ?? 0) + 1

  const slots = weekSlots({ weekStart, perWeek: freq.per_week ?? {}, preferredTimes: freq.preferred_times ?? [], timeZone, existing })
  if (!slots.length) return { summary: `La semana del ${weekStart} ya estaba completa.`, week_start: weekStart, created: 0, sources: [] }

  const ctx = await loadBrandContext(db)
  const { data: recent } = await db.rpc('recent_topics', { p_days: ctx.avoidRepeatDays })
  const recentTopics = ((recent ?? []) as { topic_key: string }[]).map((r) => r.topic_key)
  const { data: recentItems } = await db
    .from('content_items')
    .select('title, topic_key')
    .gte('created_at', new Date(Date.now() - ctx.avoidRepeatDays * 86_400_000).toISOString())

  const prompt = [
    `Armá el plan de Instagram de la semana que empieza el ${weekStart}. Hay ${slots.length} espacios:`,
    ...slots.map(formatLine),
    '',
    'Para cada espacio, una pieza lista para aprobar:',
    '- Investigá con búsqueda web: cada dato concreto (clima, temporada, eventos, requisitos) tiene que salir de una fuente que hayas consultado; poné esas URL en "sources".',
    '- Variá destinos y enfoques (gastronomía, naturaleza, cultura, escapadas, consejos). Como máximo dos piezas por destino en la semana.',
    `- "caption": texto de Instagram en español rioplatense, con gancho en la primera línea, valor concreto y un llamado a la acción suave para consultar a ${brand.brand_name ?? 'la agencia'}. Máximo 1800 caracteres. Las historias, breves (1 a 3 líneas).`,
    `- "hashtags": entre 8 y 15, sin #. Incluí siempre: ${(brand.default_hashtags ?? ['AvoraTravel']).join(', ')}.`,
    '- "media_queries": búsquedas EN INGLÉS para encontrar fotos reales del destino en un banco de imágenes (ej.: "Perito Moreno glacier", "Cafayate vineyards"). Una sola para posts e historias, de 3 a 5 distintas para carruseles (una por diapositiva) y una para reels (se busca un video vertical).',
    '- "alt_text": descripción accesible de la imagen, en español.',
    '- Sin precios, tarifas, descuentos, cupos ni promociones: no tenés fuente comercial verificable.',
    recentTopics.length ? `- Evitá estos temas usados hace poco: ${recentTopics.join(', ')}.` : '',
    `- "slot" es el número del espacio (1 a ${slots.length}). Devolvé exactamente ${slots.length} piezas.`,
    '',
    `Forma de la respuesta:\n${SCHEMA_HINT}`,
  ]
    .filter(Boolean)
    .join('\n')

  const output = (await provider.generateJSON({
    system: ctx.system,
    prompt,
    schemaHint: SCHEMA_HINT,
    needsWebSources: true,
    webSearchMaxUses: Math.min(12, 4 + slots.length),
    maxTokens: 32000,
  })) as { pieces?: Piece[] }

  const pieces = Array.isArray(output.pieces) ? output.pieces : []
  const key = pexelsKey()
  const { data: used } = await db.from('content_assets').select('credit').not('credit', 'is', null).limit(2000)
  const usedMedia = new Set<string>((used ?? []).map((r: any) => r.credit?.provider_id).filter(Boolean))

  const accepted: { title: string; topic_key: string | null }[] = [...(recentItems ?? [])]
  const report: { slot: number; title?: string; status: 'created' | 'skipped'; reason?: string; content_id?: string; media?: string }[] = []
  const allSources = new Map<string, { url: string; title: string }>()
  const taken = new Set<number>()

  for (const p of pieces) {
    const idx = Number(p?.slot) - 1
    const slot = slots[idx]
    if (!slot || taken.has(idx)) continue
    const title = String(p.title ?? '').trim().slice(0, 200)
    const caption = String(p.caption ?? '').trim()
    const sources = Array.isArray(p.sources) ? p.sources : []
    const skip = (reason: string) => report.push({ slot: idx + 1, title, status: 'skipped', reason })

    if (!title || !caption) { skip('Pieza incompleta.'); continue }
    if (!sources.length) { skip('Sin fuentes verificables.'); continue }
    if (mentionsPrice(`${title}\n${caption}`)) { skip('Mencionaba precios sin fuente comercial.'); continue }
    if (caption.length > INSTAGRAM_CAPTION_MAX) { skip('Texto demasiado largo.'); continue }
    const topic_key = slug(`${p.destination ?? ''} ${p.angle ?? ''}`) ?? slug(title)
    const repeated = repetitionReason({ topic_key, title }, accepted)
    if (repeated) { skip(repeated); continue }
    if (ctx.excluded.some((x) => slug(x) === slug(p.destination ?? ''))) { skip('Destino excluido en Configuración.'); continue }

    const defaults = normalizeHashtags(brand.default_hashtags ?? [])
    const hashtags = normalizeHashtags([...defaults, ...(Array.isArray(p.hashtags) ? p.hashtags : [])]).slice(0, Math.min(15, INSTAGRAM_HASHTAG_MAX))
    sources.forEach((s) => allSources.set(s.url, s))

    const { data: item, error } = await db
      .from('content_items')
      .insert({
        title,
        caption,
        hashtags,
        format: slot.format,
        status: 'generating',
        origin: 'agent',
        destination: p.destination || null,
        topic_key,
        scheduled_at: slot.at,
        sources,
        agent_run_id: runId,
        notes: 'Generado automáticamente por el agente. Revisá texto, imagen y fuentes antes de aprobar.',
        created_by: userId,
      })
      .select('id')
      .single()
    if (error || !item) { skip(`No se pudo guardar: ${error?.message ?? 'error'}`); continue }
    taken.add(idx)
    accepted.push({ title, topic_key })

    let mediaNote = ''
    if (!key) {
      mediaNote = 'Sin material visual: falta configurar el banco de fotos (PEXELS_API_KEY).'
    } else {
      try {
        const n = await attachMedia(item.id, slot.format, p, usedMedia, key)
        mediaNote = n ? '' : 'No se encontró material visual adecuado; agregalo antes de aprobar.'
      } catch (e) {
        mediaNote = `No se pudo obtener el material visual: ${e instanceof Error ? e.message : String(e)}`
      }
    }

    await db
      .from('content_items')
      .update({
        status: 'pending_approval',
        ...(mediaNote ? { notes: `Generado automáticamente por el agente. ${mediaNote}` } : {}),
      })
      .eq('id', item.id)
    report.push({ slot: idx + 1, title, status: 'created', content_id: item.id, media: mediaNote || 'ok' })
  }

  const created = report.filter((r) => r.status === 'created').length
  await logServer('agent.week_planned', `El agente armó ${created} de ${slots.length} piezas para la semana del ${weekStart}`, {
    actorId: userId ?? undefined,
    entityType: 'agent_run',
    entityId: runId,
    details: { week_start: weekStart, created, planned: slots.length },
  })
  return {
    summary: `Semana del ${weekStart}: ${created} de ${slots.length} piezas creadas y pendientes de aprobación.`,
    week_start: weekStart,
    created,
    planned: slots.length,
    pieces: report,
    sources: [...allSources.values()],
  }
}

async function attachMedia(contentId: string, format: ContentFormat, p: Piece, usedMedia: Set<string>, key: string): Promise<number> {
  const db = supabaseAdmin()
  const queries = (Array.isArray(p.media_queries) ? p.media_queries : []).map((q) => String(q).trim()).filter(Boolean)
  if (!queries.length && p.destination) queries.push(p.destination)
  if (!queries.length) return 0

  let picks: StockMedia[] = []
  if (format === 'reel') {
    for (const q of queries) {
      const v = await findVerticalVideo(q, usedMedia, key)
      if (v) { picks = [v]; break }
    }
  } else if (format === 'carousel') {
    const max = FORMAT_SPECS.carousel.maxAssets ?? 10
    for (const q of queries.slice(0, Math.min(5, max))) {
      const [photo] = await findPhotos(q, format, 1, new Set([...usedMedia, ...picks.map((x) => x.provider_id)]), key)
      if (photo) picks.push(photo)
    }
    if (picks.length < 2) {
      const extra = await findPhotos(queries[0], format, 3 - picks.length, new Set([...usedMedia, ...picks.map((x) => x.provider_id)]), key)
      picks.push(...extra)
    }
  } else {
    for (const q of queries) {
      const [photo] = await findPhotos(q, format, 1, usedMedia, key)
      if (photo) { picks = [photo]; break }
    }
  }

  let position = 0
  for (const m of picks) {
    const { bytes, mime } = await download(m)
    const ext = mime === 'video/mp4' ? 'mp4' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
    const path = `content/${contentId}/${crypto.randomUUID()}.${ext}`
    const up = await db.storage.from(MEDIA_BUCKET).upload(path, new Blob([bytes], { type: mime }), { contentType: mime, upsert: false })
    if (up.error) throw up.error
    const { error } = await db.from('content_assets').insert({
      content_id: contentId,
      storage_path: path,
      mime_type: mime,
      width: m.width,
      height: m.height,
      duration_seconds: m.duration_seconds ?? null,
      position: position++,
      alt_text: p.alt_text || m.alt,
      source: 'stock',
      credit: { provider: m.provider, provider_id: m.provider_id, author: m.author, author_url: m.author_url, page_url: m.page_url },
    })
    if (error) throw error
    usedMedia.add(m.provider_id)
  }
  return picks.length
}

