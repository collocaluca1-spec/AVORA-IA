import { STATUS_LABELS, type ContentStatus } from '@shared/content'
import { cn } from '../ui/cn'

export const STATUS_STYLES: Record<ContentStatus, { badge: string; dot: string; bar: string }> = {
  draft: { badge: 'bg-cream-200 text-cocoa-600', dot: 'bg-cocoa-400', bar: 'border-l-cocoa-400' },
  generating: { badge: 'bg-sky-100 text-sky-600', dot: 'bg-sky-600 animate-pulse', bar: 'border-l-sky-600' },
  pending_approval: { badge: 'bg-amber-100 text-amber-600', dot: 'bg-amber-600', bar: 'border-l-amber-600' },
  approved: { badge: 'bg-sage-100 text-sage-600', dot: 'bg-sage-600', bar: 'border-l-sage-600' },
  scheduled: { badge: 'bg-champagne-100 text-gold-600 ring-1 ring-champagne-200', dot: 'bg-gold-500', bar: 'border-l-gold-500' },
  publishing: { badge: 'bg-sky-100 text-sky-600', dot: 'bg-sky-600 animate-pulse', bar: 'border-l-sky-600' },
  published: { badge: 'bg-cocoa-800 text-champagne-200', dot: 'bg-cocoa-800', bar: 'border-l-cocoa-800' },
  error: { badge: 'bg-rose-100 text-rose-600', dot: 'bg-rose-600', bar: 'border-l-rose-600' },
  rejected: { badge: 'bg-rose-100/60 text-rose-600/80', dot: 'bg-rose-600/60', bar: 'border-l-rose-600/60' },
}

export function StatusBadge({ status, className }: { status: ContentStatus; className?: string }) {
  const s = STATUS_STYLES[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.72rem] font-normal', s.badge, className)}>
      <span className={cn('size-1.5 rounded-full', s.dot)} />
      {STATUS_LABELS[status]}
    </span>
  )
}
