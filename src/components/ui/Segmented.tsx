import { cn } from './cn'

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  className?: string
}) {
  return (
    <div className={cn('inline-flex rounded-full bg-cream-200/70 p-1 ring-1 ring-cream-300/60', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-full px-3.5 py-1.5 text-[0.82rem] transition',
            value === o.value ? 'bg-cream-50 text-cocoa-900 shadow-soft' : 'text-cocoa-500 hover:text-cocoa-800',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
