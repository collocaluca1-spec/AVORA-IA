import { useState } from 'react'
import { ShieldCheck, ExternalLink } from 'lucide-react'
import { FORMAT_SPECS, type ContentStatus } from '@shared/content'
import { listContent, type ContentWithAssets } from '@/lib/api/content'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/auth/AuthProvider'
import { friendlyDateTime, relative } from '@/lib/dates'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Segmented'
import { EmptyState, ErrorNote } from '@/components/ui/EmptyState'
import { PageLoader } from '@/components/ui/Spinner'
import { InstagramPreview } from '@/components/content/InstagramPreview'
import { StatusBadge } from '@/components/content/StatusBadge'
import { ContentActions } from '@/components/content/ContentActions'
import { ContentDetailModal } from '@/components/content/ContentDetail'
import { FormatIcon } from '@/components/content/FormatIcon'

type Tab = 'pending' | 'approved' | 'rejected' | 'error'
const TABS: Record<Tab, { label: string; statuses: ContentStatus[]; empty: string }> = {
  pending: { label: 'Pendientes', statuses: ['pending_approval'], empty: 'No hay contenido esperando aprobación.' },
  approved: { label: 'Aprobados sin programar', statuses: ['approved'], empty: 'Todo lo aprobado ya está programado.' },
  rejected: { label: 'Rechazados', statuses: ['rejected'], empty: 'No hay contenido rechazado.' },
  error: { label: 'Con error', statuses: ['error'], empty: 'No hay errores.' },
}

export default function ApprovalsPage() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState<Tab>('pending')
  const [openId, setOpenId] = useState<string | null>(null)
  const list = useAsync(() => listContent({ statuses: TABS[tab].statuses }), [tab])

  return (
    <>
      <PageHeader
        eyebrow="Sistema de aprobaciones"
        title="Aprobaciones"
        description={
          isAdmin
            ? 'Nada se publica sin tu aprobación. Revisá, aprobá o rechazá con un motivo.'
            : 'Solo los administradores pueden aprobar o rechazar. Podés seguir el estado de cada pieza.'
        }
      />
      <Segmented
        className="mb-6 max-w-full overflow-x-auto"
        value={tab}
        onChange={setTab}
        options={(Object.keys(TABS) as Tab[]).map((k) => ({ value: k, label: TABS[k].label }))}
      />

      {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
      {list.loading && !list.data ? (
        <PageLoader />
      ) : list.data?.length ? (
        <div className="space-y-5">
          {list.data.map((c) => (
            <ReviewCard key={c.id} item={c} onChanged={list.reload} onOpen={() => setOpenId(c.id)} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<ShieldCheck className="size-6" strokeWidth={1.25} />} title="Todo al día" description={TABS[tab].empty} />
        </Card>
      )}

      <ContentDetailModal id={openId} onClose={() => setOpenId(null)} onChanged={list.reload} />
    </>
  )
}

function ReviewCard({ item, onChanged, onOpen }: { item: ContentWithAssets; onChanged: () => void; onOpen: () => void }) {
  const spec = FORMAT_SPECS[item.format]
  return (
    <Card className="grid gap-6 p-5 sm:p-6 md:grid-cols-[260px_1fr] animate-fade-in">
      <div className="md:max-w-[260px]">
        <InstagramPreview format={item.format} media={item.content_assets.map((a) => ({ key: a.id, asset: a }))} caption="" hashtags={[]} hideCaption />
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={item.status} />
          <span className="inline-flex items-center gap-1 text-xs text-cocoa-500">
            <FormatIcon format={item.format} className="size-3.5" /> {spec.label}
          </span>
          <span className="text-xs text-cocoa-400">· actualizado {relative(item.updated_at)}</span>
        </div>
        <h2 className="text-2xl leading-tight sm:text-3xl">{item.title}</h2>
        <p className="mt-1 text-sm text-cocoa-500">
          {friendlyDateTime(item.scheduled_at)}
          {item.destination && ` · ${item.destination}`}
        </p>
        <p className="mt-4 whitespace-pre-line text-[0.92rem] leading-relaxed text-cocoa-700">{item.caption || <em className="text-cocoa-400">Sin descripción</em>}</p>
        {item.hashtags.length > 0 && <p className="mt-2 text-sm text-sky-600">{item.hashtags.map((h) => '#' + h).join(' ')}</p>}
        {item.includes_price && (
          <a href={item.price_source_url!} target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex items-center gap-1 text-xs text-gold-600 underline underline-offset-2">
            Fuente del precio <ExternalLink className="size-3" />
          </a>
        )}
        {item.status === 'rejected' && item.rejection_reason && (
          <p className="mt-3 rounded-xl bg-rose-100/70 px-3.5 py-2.5 text-sm text-rose-600">Motivo: {item.rejection_reason}</p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
          <ContentActions item={item} onChanged={onChanged} size="md" />
          <button onClick={onOpen} className="ml-auto text-xs text-cocoa-500 underline-offset-4 hover:underline">
            Ver historial
          </button>
        </div>
      </div>
    </Card>
  )
}
