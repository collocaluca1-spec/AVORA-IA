import { CalendarClock, Sparkles, BadgeDollarSign } from 'lucide-react'
import { FORMAT_SPECS } from '@shared/content'
import type { ContentWithAssets } from '@/lib/api/content'
import { friendlyDateTime } from '@/lib/dates'
import { MediaView } from './MediaThumb'
import { StatusBadge } from './StatusBadge'
import { FormatIcon } from './FormatIcon'
import { cn } from '../ui/cn'

export function ContentCard({
  item,
  onOpen,
  className,
}: {
  item: ContentWithAssets
  onOpen?: () => void
  className?: string
}) {
  const first = item.content_assets[0]
  const spec = FORMAT_SPECS[item.format]
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group flex w-full gap-4 rounded-2xl bg-cream-50 p-3 text-left ring-1 ring-cream-300/70 transition hover:-translate-y-0.5 hover:shadow-lift hover:ring-champagne-300',
        className,
      )}
    >
      <div className="relative w-20 shrink-0 overflow-hidden rounded-xl bg-cream-200 sm:w-24" style={{ aspectRatio: `${spec.width}/${spec.height}` }}>
        {first ? (
          <MediaView asset={first} className="absolute inset-0 size-full" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-cocoa-400">
            <FormatIcon format={item.format} className="size-5" />
          </div>
        )}
        {item.content_assets.length > 1 && (
          <span className="absolute right-1 top-1 rounded-full bg-cocoa-900/60 px-1.5 text-[0.6rem] text-white">
            {item.content_assets.length}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            <span className="inline-flex items-center gap-1 text-[0.72rem] text-cocoa-500">
              <FormatIcon format={item.format} className="size-3.5" />
              {spec.shortLabel}
            </span>
            {item.origin === 'agent' && (
              <span className="inline-flex items-center gap-1 text-[0.72rem] text-gold-600">
                <Sparkles className="size-3" /> Agente
              </span>
            )}
            {item.includes_price && (
              <span className="inline-flex items-center gap-1 text-[0.72rem] text-cocoa-500" title="Incluye precio con fuente">
                <BadgeDollarSign className="size-3.5" strokeWidth={1.5} />
              </span>
            )}
          </div>
          <h3 className="truncate font-display text-[1.15rem] leading-snug text-cocoa-900 group-hover:text-cocoa-800">{item.title}</h3>
          <p className="line-clamp-2 text-[0.8rem] text-cocoa-500">{item.caption || 'Sin descripción'}</p>
        </div>
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-[0.75rem] text-cocoa-500">
          <CalendarClock className="size-3.5" strokeWidth={1.5} />
          {friendlyDateTime(item.scheduled_at)}
          {item.destination && <span className="truncate text-cocoa-400">· {item.destination}</span>}
        </p>
      </div>
    </button>
  )
}
