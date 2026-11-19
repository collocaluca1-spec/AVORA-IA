import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { addDays, isSameDay, startOfDay } from 'date-fns'
import { ArrowUpRight, Plus, ShieldCheck, CheckCircle2, CalendarClock, Send, Clapperboard, Smartphone, AlertTriangle, PenLine } from 'lucide-react'
import { INTEGRATIONS } from '@shared/integrations'
import type { ContentStatus } from '@shared/content'
import { contentCounts, listContent } from '@/lib/api/content'
import { getSetting, listIntegrations } from '@/lib/api/settings'
import { listActivity } from '@/lib/api/activity'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/auth/AuthProvider'
import { fmt, relative } from '@/lib/dates'
import { PageHeader } from '@/components/ui/PageHeader'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState, ErrorNote } from '@/components/ui/EmptyState'
import { ContentCard } from '@/components/content/ContentCard'
import { ContentDetailModal } from '@/components/content/ContentDetail'
import { IntegrationStatusPill } from '@/components/content/IntegrationStatusPill'
import { STATUS_STYLES } from '@/components/content/StatusBadge'
import { FormatIcon } from '@/components/content/FormatIcon'
import { cn } from '@/components/ui/cn'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const [openId, setOpenId] = useState<string | null>(null)
  const today = startOfDay(new Date())

  const counts = useAsync(contentCounts, [])
  const pending = useAsync(() => listContent({ statuses: ['pending_approval'], limit: 4 }), [])
  const upcoming = useAsync(
    () => listContent({ from: today.toISOString(), to: addDays(today, 7).toISOString(), orderBy: 'scheduled_at' }),
    [],
  )
  const integrations = useAsync(listIntegrations, [])
  const automations = useAsync(() => getSetting('automations'), [])
  const activity = useAsync(() => listActivity({ limit: 6 }), [])

  const reloadAll = () => {
    counts.reload()
    pending.reload()
    upcoming.reload()
    activity.reload()
  }

  const by = useMemo(() => {
    const status: Partial<Record<ContentStatus, number>> = {}
    let reels = 0
    let stories = 0
    let reelsPublished = 0
    let storiesPublished = 0
    for (const r of counts.data ?? []) {
      status[r.status] = (status[r.status] ?? 0) + r.total
      if (r.status === 'rejected') continue
      if (r.format === 'reel') {
        reels += r.total
        if (r.status === 'published') reelsPublished += r.total
      }
      if (r.format === 'story') {
        stories += r.total
        if (r.status === 'published') storiesPublished += r.total
      }
    }
    return { status, reels, stories, reelsPublished, storiesPublished }
  }, [counts.data])

  const kpis = [
    { label: 'Pendientes', status: 'pending_approval' as const, icon: ShieldCheck, to: '/aprobaciones' },
    { label: 'Aprobadas', status: 'approved' as const, icon: CheckCircle2, to: '/contenidos?estado=approved' },
    { label: 'Programadas', status: 'scheduled' as const, icon: CalendarClock, to: '/calendario' },
    { label: 'Publicadas', status: 'published' as const, icon: Send, to: '/contenidos?estado=published' },
  ]

  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i))
  const firstName = profile?.full_name?.split(' ')[0]

  return (
    <>
      <PageHeader
        eyebrow={fmt(new Date(), "EEEE d 'de' MMMM")}
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        description="Resumen del contenido de AVORA TRAVEL y del estado de las conexiones."
        actions={
          <ButtonLink to="/estudio" icon={<Plus className="size-4" strokeWidth={1.75} />}>
            Nuevo contenido
          </ButtonLink>
        }
      />

      {counts.error && <ErrorNote message={counts.error} onRetry={counts.reload} />}

      {/* Indicadores principales */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <Link
            key={k.label}
            to={k.to}
            className={cn(
              'group relative overflow-hidden rounded-2xl p-5 ring-1 transition hover:-translate-y-0.5 hover:shadow-lift animate-fade-in',
              i === 0 ? 'bg-cocoa-800 text-cream-50 ring-cocoa-700' : 'bg-cream-50 ring-cream-300/70 shadow-soft',
            )}
          >
            <div className="flex items-center justify-between">
              <k.icon className={cn('size-5', i === 0 ? 'text-champagne-300' : 'text-gold-500')} strokeWidth={1.5} />
              <ArrowUpRight className={cn('size-4 opacity-0 transition group-hover:opacity-100', i === 0 ? 'text-champagne-300' : 'text-cocoa-400')} />
            </div>
            <p className={cn('mt-5 font-display text-5xl leading-none', i === 0 ? 'text-cream-50' : 'text-cocoa-900')}>
              {counts.loading ? '–' : by.status[k.status] ?? 0}
            </p>
            <p className={cn('mt-2 text-[0.8rem]', i === 0 ? 'text-cream-200/80' : 'text-cocoa-500')}>{k.label}</p>
          </Link>
        ))}
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-4">
        <MiniStat icon={<Clapperboard className="size-4" strokeWidth={1.5} />} label="Reels generados" value={by.reels} sub={`${by.reelsPublished} publicados`} />
        <MiniStat icon={<Smartphone className="size-4" strokeWidth={1.5} />} label="Historias generadas" value={by.stories} sub={`${by.storiesPublished} publicadas`} />
        <MiniStat icon={<PenLine className="size-4" strokeWidth={1.5} />} label="Borradores" value={by.status.draft ?? 0} />
        <MiniStat icon={<AlertTriangle className="size-4" strokeWidth={1.5} />} label="Con error" value={by.status.error ?? 0} tone={by.status.error ? 'alert' : undefined} />
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <div className="min-w-0 space-y-6">
          {/* Agenda de 7 días */}
          <Card>
            <CardHeader
              eyebrow="Próximos 7 días"
              title="Calendario de actividades"
              action={
                <ButtonLink to="/calendario" variant="ghost" size="sm">
                  Ver calendario
                </ButtonLink>
              }
            />
            <div className="overflow-x-auto px-4 pb-5 pt-5 sm:px-6">
            <div className="grid min-w-[30rem] grid-cols-7 gap-1.5 sm:gap-2">
              {days.map((d) => {
                const items = (upcoming.data ?? []).filter((c) => c.scheduled_at && isSameDay(new Date(c.scheduled_at), d))
                const isToday = isSameDay(d, today)
                return (
                  <div key={d.toISOString()} className={cn('min-h-32 rounded-xl p-1.5 ring-1 sm:p-2', isToday ? 'bg-champagne-100/70 ring-champagne-200' : 'bg-cream-100/60 ring-cream-200')}>
                    <p className="text-center text-[0.62rem] uppercase tracking-wider text-cocoa-400">{fmt(d, 'EEE')}</p>
                    <p className={cn('text-center font-display text-xl', isToday ? 'text-gold-600' : 'text-cocoa-800')}>{fmt(d, 'd')}</p>
                    <div className="mt-1.5 space-y-1">
                      {items.slice(0, 3).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setOpenId(c.id)}
                          title={c.title}
                          className={cn('flex w-full items-center gap-1 rounded-md border-l-2 bg-cream-50 px-1 py-1 text-left text-[0.62rem] leading-tight text-cocoa-700 shadow-soft', STATUS_STYLES[c.status].bar)}
                        >
                          <FormatIcon format={c.format} className="hidden size-3 shrink-0 sm:block" />
                          <span className="truncate">{fmt(c.scheduled_at!, 'HH:mm')}</span>
                        </button>
                      ))}
                      {items.length > 3 && <p className="text-center text-[0.6rem] text-cocoa-400">+{items.length - 3}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
            </div>
          </Card>

          {/* Pendientes de aprobación */}
          <Card>
            <CardHeader
              eyebrow="Requiere revisión"
              title="Pendientes de aprobación"
              action={
                <ButtonLink to="/aprobaciones" variant="ghost" size="sm">
                  Ver todas
                </ButtonLink>
              }
            />
            <div className="space-y-3 p-4 sm:p-6">
              {pending.data?.length ? (
                pending.data.map((c) => <ContentCard key={c.id} item={c} onOpen={() => setOpenId(c.id)} />)
              ) : (
                <EmptyState
                  icon={<ShieldCheck className="size-6" strokeWidth={1.25} />}
                  title="Nada pendiente"
                  description="Cuando el equipo envíe contenido a aprobación, aparecerá acá."
                  className="py-8"
                />
              )}
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          {/* Estado de conexiones */}
          <Card>
            <CardHeader
              eyebrow="Integraciones"
              title="Conexiones externas"
              action={
                <ButtonLink to="/configuracion/integraciones-ia" variant="ghost" size="sm">
                  Configurar
                </ButtonLink>
              }
            />
            <ul className="divide-y divide-cream-200 px-5 pb-3 pt-3 sm:px-6">
              {(integrations.data ?? []).map((row) => (
                <li key={row.key} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-cocoa-800">{INTEGRATIONS[row.key]?.name ?? row.key}</p>
                    <p className="text-xs text-cocoa-400">{INTEGRATIONS[row.key]?.phase}</p>
                  </div>
                  <IntegrationStatusPill status={row.status} />
                </li>
              ))}
              {integrations.error && <ErrorNote message={integrations.error} />}
            </ul>
            <div className="mx-5 mb-5 flex items-center justify-between rounded-xl bg-cream-100 px-4 py-3 ring-1 ring-cream-200 sm:mx-6">
              <span className="text-sm text-cocoa-700">Publicación automática</span>
              <span className={cn('text-xs', automations.data?.auto_publish_enabled ? 'text-sage-600' : 'text-cocoa-500')}>
                {automations.data?.auto_publish_enabled ? 'Activada' : 'Desactivada'}
              </span>
            </div>
          </Card>

          {/* Actividad reciente */}
          <Card>
            <CardHeader
              eyebrow="Registro"
              title="Actividad reciente"
              action={
                <ButtonLink to="/actividad" variant="ghost" size="sm">
                  Ver todo
                </ButtonLink>
              }
            />
            <ul className="space-y-3 px-5 pb-6 pt-4 sm:px-6">
              {(activity.data ?? []).map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', a.level === 'error' ? 'bg-rose-600' : a.level === 'warning' ? 'bg-amber-600' : 'bg-champagne-300')} />
                  <div className="min-w-0">
                    <p className="truncate text-cocoa-700">{a.message ?? a.action}</p>
                    <p className="text-xs text-cocoa-400">{relative(a.created_at)}</p>
                  </div>
                </li>
              ))}
              {activity.data?.length === 0 && <p className="text-sm text-cocoa-400">Sin actividad todavía.</p>}
            </ul>
          </Card>
        </div>
      </div>

      <ContentDetailModal id={openId} onClose={() => setOpenId(null)} onChanged={reloadAll} />
    </>
  )
}

function MiniStat({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: number; sub?: string; tone?: 'alert' }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-cream-50/70 px-4 py-3.5 ring-1 ring-cream-300/60">
      <span className={cn('grid size-9 place-items-center rounded-full', tone === 'alert' ? 'bg-rose-100 text-rose-600' : 'bg-champagne-100 text-gold-600')}>{icon}</span>
      <div className="min-w-0">
        <p className="font-display text-2xl leading-none text-cocoa-900">{value}</p>
        <p className="truncate text-[0.72rem] text-cocoa-500">
          {label}
          {sub && <span className="text-cocoa-400"> · {sub}</span>}
        </p>
      </div>
    </div>
  )
}
