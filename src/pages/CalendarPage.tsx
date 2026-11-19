import { useMemo, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  setHours,
  setMinutes,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react'
import { CONTENT_STATUSES, STATUS_LABELS, type ContentStatus } from '@shared/content'
import { listContent, updateContent, type ContentWithAssets } from '@/lib/api/content'
import { useAsync } from '@/hooks/useAsync'
import { fmt } from '@/lib/dates'
import { friendlyError } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Segmented'
import { ErrorNote, EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { ContentDetailModal } from '@/components/content/ContentDetail'
import { ContentCard } from '@/components/content/ContentCard'
import { FormatIcon } from '@/components/content/FormatIcon'
import { STATUS_STYLES } from '@/components/content/StatusBadge'
import { cn } from '@/components/ui/cn'

type View = 'month' | 'week' | 'day'
const WEEK = { weekStartsOn: 1 as const }
const LOCKED: ContentStatus[] = ['generating', 'publishing', 'published']

function range(view: View, cursor: Date) {
  if (view === 'month') return { from: startOfWeek(startOfMonth(cursor), WEEK), to: startOfDay(addDays(endOfWeek(endOfMonth(cursor), WEEK), 1)) }
  if (view === 'week') return { from: startOfWeek(cursor, WEEK), to: startOfDay(addDays(endOfWeek(cursor, WEEK), 1)) }
  return { from: startOfDay(cursor), to: addDays(startOfDay(cursor), 1) }
}

export default function CalendarPage() {
  const [view, setView] = useState<View>('month')
  const [cursor, setCursor] = useState(new Date())
  const [openId, setOpenId] = useState<string | null>(null)
  const [hidden, setHidden] = useState<ContentStatus[]>(['rejected'])
  const [dragId, setDragId] = useState<string | null>(null)
  const nav = useNavigate()
  const toast = useToast()

  const { from, to } = range(view, cursor)
  const list = useAsync(() => listContent({ from: from.toISOString(), to: to.toISOString(), orderBy: 'scheduled_at' }), [from.getTime(), to.getTime()])
  const unscheduled = useAsync(() => listContent({ statuses: ['draft', 'pending_approval', 'approved'], limit: 60 }).then((r) => r.filter((c) => !c.scheduled_at)), [])

  const items = useMemo(() => (list.data ?? []).filter((c) => !hidden.includes(c.status)), [list.data, hidden])
  const byDay = (d: Date) => items.filter((c) => c.scheduled_at && isSameDay(new Date(c.scheduled_at), d))

  const move = (dir: -1 | 1) =>
    setCursor((c) => (view === 'month' ? addMonths(c, dir) : view === 'week' ? addWeeks(c, dir) : addDays(c, dir)))

  const title =
    view === 'month'
      ? fmt(cursor, 'MMMM yyyy')
      : view === 'week'
        ? `${fmt(from, "d 'de' MMM")} – ${fmt(addDays(to, -1), "d 'de' MMM yyyy")}`
        : fmt(cursor, "EEEE d 'de' MMMM")

  function newAt(d: Date) {
    const at = setMinutes(setHours(d, 10), 0)
    nav(`/estudio?fecha=${encodeURIComponent(at.toISOString())}`)
  }

  // Reprogramar arrastrando: conserva la hora, cambia el día.
  async function dropOn(day: Date, e: DragEvent) {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || dragId
    setDragId(null)
    const c = [...(list.data ?? []), ...(unscheduled.data ?? [])].find((x) => x.id === id)
    if (!c || LOCKED.includes(c.status)) return
    const base = c.scheduled_at ? new Date(c.scheduled_at) : setMinutes(setHours(day, 10), 0)
    const next = new Date(day)
    next.setHours(base.getHours(), base.getMinutes(), 0, 0)
    if (c.scheduled_at && isSameDay(base, next)) return
    if (c.status === 'scheduled' && next.getTime() <= Date.now()) return toast.error('La nueva fecha debe ser futura.')
    try {
      await updateContent(c.id, { scheduled_at: next.toISOString() })
      toast.success(`"${c.title}" movido al ${fmt(next, "d 'de' MMM, HH:mm")}.`)
      list.reload()
      unscheduled.reload()
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  const chip = (c: ContentWithAssets, size: 'xs' | 'sm' = 'xs') => (
    <button
      key={c.id}
      draggable={!LOCKED.includes(c.status)}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', c.id)
        setDragId(c.id)
      }}
      onClick={(e) => {
        e.stopPropagation()
        setOpenId(c.id)
      }}
      title={`${c.title} · ${STATUS_LABELS[c.status]}`}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-lg border-l-[3px] bg-cream-50 text-left text-cocoa-800 shadow-soft ring-1 ring-cream-200 transition hover:ring-champagne-300',
        STATUS_STYLES[c.status].bar,
        size === 'xs' ? 'px-1.5 py-1 text-[0.68rem]' : 'px-2.5 py-2 text-[0.78rem]',
        !LOCKED.includes(c.status) && 'cursor-grab active:cursor-grabbing',
      )}
    >
      <FormatIcon format={c.format} className="size-3 shrink-0 text-cocoa-400" />
      {c.scheduled_at && <span className="shrink-0 text-cocoa-400">{fmt(c.scheduled_at, 'HH:mm')}</span>}
      <span className="truncate">{c.title}</span>
    </button>
  )

  const dropProps = (d: Date) => ({
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDrop: (e: DragEvent) => dropOn(d, e),
  })

  return (
    <>
      <PageHeader
        eyebrow="Calendario editorial"
        title="Calendario"
        description="Arrastrá una publicación a otro día para reprogramarla. Hacé clic para editar, aprobar, rechazar o cancelar."
        actions={
          <Button onClick={() => newAt(addDays(new Date(), 1))} icon={<Plus className="size-4" strokeWidth={1.75} />}>
            Nuevo contenido
          </Button>
        }
      />

      <Card className="mb-5 flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => move(-1)} aria-label="Anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => move(1)} aria-label="Siguiente">
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="ml-1 text-2xl capitalize">{title}</h2>
          <Button variant="secondary" size="sm" className="ml-2" onClick={() => setCursor(new Date())}>
            Hoy
          </Button>
        </div>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'month', label: 'Mes' },
            { value: 'week', label: 'Semana' },
            { value: 'day', label: 'Día' },
          ]}
        />
      </Card>

      <div className="mb-5 flex flex-wrap gap-x-4 gap-y-2">
        {CONTENT_STATUSES.map((s) => (
          <label key={s} className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-cocoa-600">
            <input
              type="checkbox"
              className="accent-cocoa-800"
              checked={!hidden.includes(s)}
              onChange={(e) => setHidden((h) => (e.target.checked ? h.filter((x) => x !== s) : [...h, s]))}
            />
            <span className={cn('size-2 rounded-full', STATUS_STYLES[s].dot)} />
            {STATUS_LABELS[s]}
          </label>
        ))}
      </div>

      {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}

      {view === 'month' && (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-cream-200 bg-cream-100/70">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
              <p key={d} className="py-2.5 text-center text-[0.66rem] uppercase tracking-[0.16em] text-cocoa-400">
                {d}
              </p>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: Math.round((to.getTime() - from.getTime()) / 86_400_000) }, (_, i) => addDays(from, i)).map((d) => {
              const dayItems = byDay(d)
              const today = isSameDay(d, new Date())
              return (
                <div
                  key={d.toISOString()}
                  {...dropProps(d)}
                  onClick={() => {
                    setCursor(d)
                    setView('day')
                  }}
                  className={cn(
                    'group min-h-24 cursor-pointer border-b border-r border-cream-200 p-1 transition hover:bg-champagne-100/30 sm:min-h-32 sm:p-1.5',
                    !isSameMonth(d, cursor) && 'bg-cream-100/50 text-cocoa-400',
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className={cn('grid size-6 place-items-center rounded-full text-xs', today && 'bg-cocoa-800 text-cream-50')}>{fmt(d, 'd')}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        newAt(d)
                      }}
                      className="hidden rounded-full p-0.5 text-cocoa-400 hover:bg-cream-200 hover:text-cocoa-800 group-hover:block"
                      aria-label="Crear en este día"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <div className="hidden space-y-1 sm:block">
                    {dayItems.slice(0, 3).map((c) => chip(c))}
                    {dayItems.length > 3 && <p className="px-1 text-[0.65rem] text-cocoa-500">+{dayItems.length - 3} más</p>}
                  </div>
                  {/* móvil: puntos */}
                  <div className="flex flex-wrap gap-0.5 px-0.5 sm:hidden">
                    {dayItems.map((c) => (
                      <span key={c.id} className={cn('size-1.5 rounded-full', STATUS_STYLES[c.status].dot)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {view === 'week' && (
        <div className="grid gap-3 md:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => {
            const today = isSameDay(d, new Date())
            return (
              <div key={d.toISOString()} {...dropProps(d)} className={cn('flex min-h-40 flex-col rounded-2xl p-2.5 ring-1', today ? 'bg-champagne-100/60 ring-champagne-200' : 'bg-cream-50 ring-cream-300/70')}>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <button onClick={() => { setCursor(d); setView('day') }} className="text-left">
                    <span className="text-[0.66rem] uppercase tracking-[0.16em] text-cocoa-400">{fmt(d, 'EEE')}</span>{' '}
                    <span className={cn('font-display text-2xl', today ? 'text-gold-600' : 'text-cocoa-800')}>{fmt(d, 'd')}</span>
                  </button>
                  <button onClick={() => newAt(d)} className="rounded-full p-1 text-cocoa-400 hover:bg-cream-200 hover:text-cocoa-800" aria-label="Crear en este día">
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <div className="space-y-1.5">{byDay(d).map((c) => chip(c, 'sm'))}</div>
              </div>
            )
          })}
        </div>
      )}

      {view === 'day' && (
        <Card className="p-4 sm:p-6">
          {byDay(cursor).length ? (
            <div className="space-y-3">
              {byDay(cursor).map((c) => (
                <div key={c.id} className="flex gap-4">
                  <p className="w-14 shrink-0 pt-3 text-right font-display text-xl text-cocoa-500">{fmt(c.scheduled_at!, 'HH:mm')}</p>
                  <ContentCard item={c} onOpen={() => setOpenId(c.id)} className="flex-1" />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<CalendarDays className="size-6" strokeWidth={1.25} />}
              title="Día libre"
              description="No hay publicaciones para este día."
              action={<Button onClick={() => newAt(cursor)}>Crear para este día</Button>}
            />
          )}
        </Card>
      )}

      {(unscheduled.data?.length ?? 0) > 0 && (
        <section className="mt-8">
          <p className="eyebrow mb-3">Sin fecha asignada · arrastralos al calendario</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {unscheduled.data!.map((c) => (
              <div key={c.id} className="w-56 shrink-0">
                {chip(c, 'sm')}
              </div>
            ))}
          </div>
        </section>
      )}

      <ContentDetailModal
        id={openId}
        onClose={() => setOpenId(null)}
        onChanged={() => {
          list.reload()
          unscheduled.reload()
        }}
      />
    </>
  )
}
