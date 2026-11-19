import type { ReactNode } from 'react'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between animate-fade-in">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-[2.1rem] leading-[1.05] sm:text-[2.6rem]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[0.95rem] text-cocoa-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
