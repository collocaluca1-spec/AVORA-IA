import { useState } from 'react'
import { ScrollText } from 'lucide-react'
import { listActivity } from '@/lib/api/activity'
import { useAsync } from '@/hooks/useAsync'
import { fmt } from '@/lib/dates'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Segmented'
import { EmptyState, ErrorNote } from '@/components/ui/EmptyState'
import { PageLoader } from '@/components/ui/Spinner'
import { cn } from '@/components/ui/cn'

export default function ActivityPage() {
  const [level, setLevel] = useState<'all' | 'error' | 'warning'>('all')
  const list = useAsync(() => listActivity({ level: level === 'all' ? undefined : level, limit: 200 }), [level])
  return (
    <>
      <PageHeader eyebrow="Seguridad" title="Registro de actividad" description="Acciones del equipo, cambios de estado, configuración y errores. El registro no se puede editar ni borrar desde el panel." />
      <Segmented
        className="mb-6"
        value={level}
        onChange={setLevel}
        options={[
          { value: 'all', label: 'Todo' },
          { value: 'warning', label: 'Advertencias' },
          { value: 'error', label: 'Errores' },
        ]}
      />
      {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
      {list.loading && !list.data ? (
        <PageLoader />
      ) : list.data?.length ? (
        <Card className="divide-y divide-cream-200">
          {list.data.map((a) => (
            <div key={a.id} className="flex gap-4 px-5 py-3.5">
              <span className={cn('mt-2 size-2 shrink-0 rounded-full', a.level === 'error' ? 'bg-rose-600' : a.level === 'warning' ? 'bg-amber-600' : 'bg-champagne-300')} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-cocoa-800">{a.message ?? a.action}</p>
                <p className="font-mono text-[0.68rem] text-cocoa-400">{a.action}</p>
              </div>
              <time className="shrink-0 text-xs text-cocoa-400">{fmt(a.created_at, 'dd/MM HH:mm')}</time>
            </div>
          ))}
        </Card>
      ) : (
        <Card>
          <EmptyState icon={<ScrollText className="size-6" strokeWidth={1.25} />} title="Sin registros" />
        </Card>
      )}
    </>
  )
}
