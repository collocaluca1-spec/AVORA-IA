import { ExternalLink, Trash2 } from 'lucide-react'
import { FORMAT_SPECS, STATUS_LABELS } from '@shared/content'
import { deleteContent, getContent, listContentEvents, type ContentWithAssets } from '@/lib/api/content'
import { useAsync } from '@/hooks/useAsync'
import { friendlyDateTime, relative } from '@/lib/dates'
import { friendlyError } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { Modal } from '../ui/Modal'
import { PageLoader } from '../ui/Spinner'
import { Button } from '../ui/Button'
import { useToast } from '../ui/Toast'
import { InstagramPreview } from './InstagramPreview'
import { StatusBadge } from './StatusBadge'
import { ContentActions } from './ContentActions'

const EVENT_LABELS: Record<string, string> = {
  created: 'Creado',
  edited: 'Editado',
  edited_requires_reapproval: 'Editado · requiere nueva aprobación',
  rescheduled: 'Reprogramado',
  submit: 'Enviado a aprobación',
  approve: 'Aprobado',
  reject: 'Rechazado',
  schedule: 'Programado',
  cancel_schedule: 'Programación cancelada',
  back_to_draft: 'Vuelto a borrador',
  reopen: 'Reabierto',
  request_reapproval: 'Pedido de nueva aprobación',
  start_generation: 'Generación iniciada',
  finish_generation: 'Generación finalizada',
  start_publishing: 'Publicando',
  mark_published: 'Publicado',
  mark_error: 'Error',
}

/** Ficha completa de un contenido: vista previa, datos, historial y acciones. */
export function ContentDetailModal({
  id,
  onClose,
  onChanged,
}: {
  id: string | null
  onClose: () => void
  onChanged: () => void
}) {
  return (
    <Modal open={!!id} onClose={onClose} title="Detalle del contenido" eyebrow="Contenido" size="xl">
      {id && <DetailBody id={id} onChanged={onChanged} onClose={onClose} />}
    </Modal>
  )
}

function DetailBody({ id, onChanged, onClose }: { id: string; onChanged: () => void; onClose: () => void }) {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const item = useAsync(() => getContent(id), [id])
  const events = useAsync(() => listContentEvents(id), [id])

  if (item.loading && !item.data) return <PageLoader />
  if (item.error || !item.data) return <p className="text-sm text-rose-600">{item.error ?? 'No encontrado'}</p>
  const c: ContentWithAssets = item.data
  const spec = FORMAT_SPECS[c.format]

  const refresh = () => {
    item.reload()
    events.reload()
    onChanged()
  }

  async function remove() {
    if (!confirm(`¿Eliminar "${c.title}"? Esta acción no se puede deshacer.`)) return
    try {
      await deleteContent(c.id, c.content_assets.map((a) => a.storage_path))
      toast.success('Contenido eliminado.')
      onChanged()
      onClose()
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,300px)_1fr]">
      <InstagramPreview
        format={c.format}
        media={c.content_assets.map((a) => ({ key: a.id, asset: a }))}
        caption={c.caption}
        hashtags={c.hashtags}
      />
      <div className="min-w-0 space-y-6">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={c.status} />
            <span className="text-xs text-cocoa-500">
              {spec.label} · {spec.width}×{spec.height}
            </span>
          </div>
          <h3 className="text-3xl leading-tight">{c.title}</h3>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-cocoa-400">Fecha programada</dt>
              <dd>{friendlyDateTime(c.scheduled_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-cocoa-400">Destino</dt>
              <dd>{c.destination || '—'}</dd>
            </div>
            {c.approved_at && (
              <div>
                <dt className="text-xs text-cocoa-400">Aprobado</dt>
                <dd>{friendlyDateTime(c.approved_at)}</dd>
              </div>
            )}
            {c.includes_price && (
              <div className="col-span-2">
                <dt className="text-xs text-cocoa-400">Fuente del precio</dt>
                <dd>
                  <a href={c.price_source_url!} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-gold-600 underline underline-offset-2 break-all">
                    {c.price_source_url} <ExternalLink className="size-3" />
                  </a>
                  {c.price_source_note && <p className="text-xs text-cocoa-500">{c.price_source_note}</p>}
                </dd>
              </div>
            )}
          </dl>
          {c.status === 'rejected' && c.rejection_reason && (
            <p className="mt-4 rounded-xl bg-rose-100/70 px-4 py-3 text-sm text-rose-600">Motivo del rechazo: {c.rejection_reason}</p>
          )}
          {c.status === 'error' && c.error_message && (
            <p className="mt-4 rounded-xl bg-rose-100/70 px-4 py-3 text-sm text-rose-600">{c.error_message}</p>
          )}
          {c.notes && <p className="mt-4 rounded-xl bg-cream-200/60 px-4 py-3 text-sm text-cocoa-600">Notas internas: {c.notes}</p>}
        </div>

        <ContentActions item={c} onChanged={refresh} size="md" />

        <div>
          <p className="eyebrow mb-3">Historial</p>
          <ol className="relative space-y-3 border-l border-cream-300 pl-5">
            {(events.data ?? []).map((e) => (
              <li key={e.id} className="relative text-sm">
                <span className="absolute -left-[1.42rem] top-1.5 size-2 rounded-full bg-champagne-300 ring-4 ring-cream-50" />
                <p className="text-cocoa-800">
                  {EVENT_LABELS[e.action] ?? e.action}
                  {e.to_status && e.action === 'status_changed' && ` → ${STATUS_LABELS[e.to_status]}`}
                </p>
                {e.comment && <p className="text-xs text-cocoa-500">{e.comment}</p>}
                <p className="text-xs text-cocoa-400">{relative(e.created_at)}</p>
              </li>
            ))}
          </ol>
        </div>

        {isAdmin && !['publishing', 'published'].includes(c.status) && (
          <div className="border-t border-cream-200 pt-4">
            <Button variant="danger" size="sm" icon={<Trash2 className="size-3.5" />} onClick={remove}>
              Eliminar
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
