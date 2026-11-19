import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { CheckResult } from '@shared/contentChecks'

export function ChecksList({ checks, emptyLabel = 'Todo en orden para enviar a aprobación.' }: { checks: CheckResult[]; emptyLabel?: string }) {
  if (!checks.length)
    return (
      <p className="flex items-center gap-2 text-sm text-sage-600">
        <CheckCircle2 className="size-4" strokeWidth={1.5} /> {emptyLabel}
      </p>
    )
  return (
    <ul className="space-y-2">
      {checks.map((c) => (
        <li key={c.code + c.message} className="flex gap-2 text-sm">
          {c.level === 'error' ? (
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600" strokeWidth={1.5} />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" strokeWidth={1.5} />
          )}
          <span className={c.level === 'error' ? 'text-rose-600' : 'text-cocoa-600'}>{c.message}</span>
        </li>
      ))}
    </ul>
  )
}
