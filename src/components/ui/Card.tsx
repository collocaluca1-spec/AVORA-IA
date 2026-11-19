import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-2xl bg-cream-50 ring-1 ring-cream-300/70 shadow-soft', className)}
      {...rest}
    />
  )
}

export function CardHeader({
  title,
  eyebrow,
  action,
  className,
}: {
  title: ReactNode
  eyebrow?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2 className="text-xl sm:text-[1.4rem] leading-tight">{title}</h2>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
