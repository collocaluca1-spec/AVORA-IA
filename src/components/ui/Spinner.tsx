import { cn } from './cn'

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn('inline-block size-5 animate-spin rounded-full border-2 border-current border-r-transparent opacity-70', className)}
    />
  )
}

export function PageLoader({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-cocoa-500">
      <Spinner className="size-6 text-gold-500" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
