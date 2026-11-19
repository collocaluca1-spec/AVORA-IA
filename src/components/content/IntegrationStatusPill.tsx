import { INTEGRATION_STATUS_LABELS, type IntegrationStatus } from '@shared/integrations'
import { cn } from '../ui/cn'

const STYLES: Record<IntegrationStatus, string> = {
  not_configured: 'bg-cream-200 text-cocoa-500 ring-cream-300',
  credentials_present: 'bg-amber-100 text-amber-600 ring-amber-100',
  connected: 'bg-sage-100 text-sage-600 ring-sage-100',
  error: 'bg-rose-100 text-rose-600 ring-rose-100',
  disabled: 'bg-cream-200 text-cocoa-400 ring-cream-300',
}

export function IntegrationStatusPill({ status, className }: { status: IntegrationStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.72rem] ring-1', STYLES[status], className)}>
      <span className={cn('size-1.5 rounded-full', status === 'connected' ? 'bg-sage-600' : status === 'error' ? 'bg-rose-600' : status === 'credentials_present' ? 'bg-amber-600' : 'bg-cocoa-400/60')} />
      {INTEGRATION_STATUS_LABELS[status]}
    </span>
  )
}
