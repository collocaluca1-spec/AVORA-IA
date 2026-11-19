import type { ReactNode } from 'react'
import { cn } from './cn'

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon && (
        <div className="mb-4 grid size-14 place-items-center rounded-full bg-champagne-100 text-gold-600 ring-1 ring-champagne-200">
          {icon}
        </div>
      )}
      <h3 className="text-xl">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-cocoa-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-rose-100/70 px-4 py-3 text-sm text-rose-600 ring-1 ring-rose-100">
      <span>{message}</span>
      {onRetry && (
        <button className="underline underline-offset-2" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  )
}
