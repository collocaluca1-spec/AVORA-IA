import { db } from '../supabase'
import type { ContentAsset, ContentItem, ContentStatus, ContentFormat } from '@shared/content'

export interface ContentWithAssets extends ContentItem {
  content_assets: ContentAsset[]
}

const SELECT_WITH_ASSETS = '*, content_assets(*)'

function sortAssets<T extends { content_assets?: ContentAsset[] }>(row: T): T {
  row.content_assets?.sort((a, b) => a.position - b.position)
  return row
}

export interface ContentFilter {
  statuses?: ContentStatus[]
  formats?: ContentFormat[]
  from?: string
  to?: string
  search?: string
  limit?: number
  orderBy?: 'updated_at' | 'scheduled_at'
}

export async function listContent(f: ContentFilter = {}): Promise<ContentWithAssets[]> {
  let q = db().from('content_items').select(SELECT_WITH_ASSETS)
  if (f.statuses?.length) q = q.in('status', f.statuses)
  if (f.formats?.length) q = q.in('format', f.formats)
  if (f.from) q = q.gte('scheduled_at', f.from)
  if (f.to) q = q.lt('scheduled_at', f.to)
  if (f.search?.trim()) {
    const s = f.search.trim().replace(/[%,()]/g, ' ')
    q = q.or(`title.ilike.%${s}%,caption.ilike.%${s}%,destination.ilike.%${s}%`)
  }
  const orderBy = f.orderBy ?? 'updated_at'
  q = q.order(orderBy, { ascending: orderBy === 'scheduled_at', nullsFirst: false })
  if (f.limit) q = q.limit(f.limit)
  const { data, error } = await q
  if (error) throw error
  return (data as ContentWithAssets[]).map(sortAssets)
}

export async function getContent(id: string): Promise<ContentWithAssets> {
  const { data, error } = await db().from('content_items').select(SELECT_WITH_ASSETS).eq('id', id).single()
  if (error) throw error
  return sortAssets(data as ContentWithAssets)
}

export type ContentDraft = Pick<
  ContentItem,
  | 'title'
  | 'caption'
  | 'hashtags'
  | 'format'
  | 'destination'
  | 'topic_key'
  | 'notes'
  | 'scheduled_at'
  | 'includes_price'
  | 'price_source_url'
  | 'price_source_note'
>

export async function createContent(draft: ContentDraft): Promise<ContentItem> {
  const { data, error } = await db().from('content_items').insert({ ...draft, status: 'draft' }).select().single()
  if (error) throw error
  return data as ContentItem
}

export async function updateContent(id: string, patch: Partial<ContentDraft>): Promise<ContentItem> {
  const { data, error } = await db().from('content_items').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data as ContentItem
}

/** Cambio de estado. Las reglas las valida la base de datos (trigger de flujo). */
export async function transitionContent(
  id: string,
  to: ContentStatus,
  extra: { rejection_reason?: string; scheduled_at?: string | null } = {},
): Promise<ContentItem> {
  const { data, error } = await db()
    .from('content_items')
    .update({ status: to, ...extra })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as ContentItem
}

export async function deleteContent(id: string, storagePaths: string[]): Promise<void> {
  const { error } = await db().from('content_items').delete().eq('id', id)
  if (error) throw error
  if (storagePaths.length) await db().storage.from('content-media').remove(storagePaths)
}

export interface ContentEvent {
  id: number
  content_id: string
  actor_id: string | null
  action: string
  from_status: ContentStatus | null
  to_status: ContentStatus | null
  comment: string | null
  created_at: string
}

export async function listContentEvents(contentId: string): Promise<ContentEvent[]> {
  const { data, error } = await db()
    .from('content_events')
    .select('*')
    .eq('content_id', contentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as ContentEvent[]
}

export async function contentCounts(): Promise<{ status: ContentStatus; format: ContentFormat; total: number }[]> {
  const { data, error } = await db().from('content_counts').select('*')
  if (error) throw error
  return data as { status: ContentStatus; format: ContentFormat; total: number }[]
}

/** Publica ya en Instagram un contenido aprobado (solo administradores). */
export async function publishNow(id: string): Promise<string> {
  const { data: s } = await db().auth.getSession()
  const res = await fetch('/api/publish-now', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${s.session?.access_token}` },
    body: JSON.stringify({ content_id: id }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.message ?? 'No se pudo publicar.')
  return body.message ?? 'Publicando…'
}
