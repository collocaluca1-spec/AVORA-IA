import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Library, Plus, Search } from 'lucide-react'
import { CONTENT_FORMATS, CONTENT_STATUSES, FORMAT_SPECS, STATUS_LABELS, type ContentFormat, type ContentStatus } from '@shared/content'
import { listContent } from '@/lib/api/content'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/ui/PageHeader'
import { ButtonLink } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { EmptyState, ErrorNote } from '@/components/ui/EmptyState'
import { PageLoader } from '@/components/ui/Spinner'
import { ContentCard } from '@/components/content/ContentCard'
import { ContentDetailModal } from '@/components/content/ContentDetail'
import { STATUS_STYLES } from '@/components/content/StatusBadge'
import { cn } from '@/components/ui/cn'

export default function LibraryPage() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('estado') as ContentStatus | null) ?? null
  const format = (params.get('formato') as ContentFormat | null) ?? null
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const list = useAsync(
    () => listContent({ statuses: status ? [status] : undefined, formats: format ? [format] : undefined, search: q }),
    [status, format, q],
  )

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader
        eyebrow="Biblioteca"
        title="Contenidos"
        description="Todo el contenido guardado, en cualquier estado."
        actions={
          <ButtonLink to="/estudio" icon={<Plus className="size-4" strokeWidth={1.75} />}>
            Nuevo contenido
          </ButtonLink>
        }
      />

      <div className="mb-6 space-y-4">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip active={!status} onClick={() => setParam('estado', null)}>
            Todos
          </Chip>
          {CONTENT_STATUSES.map((s) => (
            <Chip key={s} active={status === s} onClick={() => setParam('estado', s)}>
              <span className={cn('size-1.5 rounded-full', STATUS_STYLES[s].dot)} />
              {STATUS_LABELS[s]}
            </Chip>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <form
            className="relative flex-1"
            onSubmit={(e) => {
              e.preventDefault()
              setQ(search)
            }}
          >
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-cocoa-400" />
            <Input className="pl-10" placeholder="Buscar por título, descripción o destino…" value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => setQ(search)} />
          </form>
          <Select className="sm:w-56" value={format ?? ''} onChange={(e) => setParam('formato', e.target.value || null)}>
            <option value="">Todos los formatos</option>
            {CONTENT_FORMATS.map((f) => (
              <option key={f} value={f}>
                {FORMAT_SPECS[f].label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
      {list.loading && !list.data ? (
        <PageLoader />
      ) : list.data?.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {list.data.map((c) => (
            <ContentCard key={c.id} item={c} onOpen={() => setOpenId(c.id)} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Library className="size-6" strokeWidth={1.25} />}
          title="Sin resultados"
          description={status || format || q ? 'Probá con otros filtros.' : 'Todavía no hay contenido. Empezá desde el Estudio creativo.'}
          action={!status && !format && !q && <ButtonLink to="/estudio">Crear contenido</ButtonLink>}
        />
      )}

      <ContentDetailModal id={openId} onClose={() => setOpenId(null)} onChanged={list.reload} />
    </>
  )
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.8rem] ring-1 transition',
        active ? 'bg-cocoa-800 text-cream-50 ring-cocoa-800' : 'bg-cream-50 text-cocoa-600 ring-cream-300 hover:ring-champagne-300',
      )}
    >
      {children}
    </button>
  )
}
