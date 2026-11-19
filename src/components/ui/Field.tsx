import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from './cn'

const control =
  'w-full rounded-xl bg-white/80 px-3.5 py-2.5 text-[0.92rem] text-cocoa-900 ring-1 ring-cream-300 placeholder:text-cocoa-400/80 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-champagne-300 disabled:opacity-60'

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
  aside,
}: {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
  className?: string
  htmlFor?: string
  aside?: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {(label || aside) && (
        <div className="flex items-baseline justify-between gap-2">
          {label && (
            <label htmlFor={htmlFor} className="text-[0.8rem] font-normal text-cocoa-600">
              {label}
            </label>
          )}
          {aside && <span className="text-xs text-cocoa-400">{aside}</span>}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-xs text-rose-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-cocoa-400">{hint}</p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(control, className)} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(control, 'min-h-28 leading-relaxed', className)} {...rest} />
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={cn(control, 'appearance-none pr-9 bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27 fill=%27%237d6655%27%3E%3Cpath d=%27M5.5 7.5 10 12l4.5-4.5%27 stroke=%27%237d6655%27 stroke-width=%271.5%27 fill=%27none%27/%3E%3C/svg%3E")] bg-[length:1.1rem] bg-[right_0.7rem_center] bg-no-repeat', className)} {...rest}>
      {children}
    </select>
  )
})

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label: ReactNode
  description?: ReactNode
}) {
  return (
    <label className={cn('flex items-start justify-between gap-4', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
      <span className="min-w-0">
        <span className="block text-[0.92rem] text-cocoa-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-cocoa-500">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-6 w-11 rounded-full bg-cream-300 transition peer-checked:bg-cocoa-800 peer-focus-visible:ring-2 peer-focus-visible:ring-gold-500" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5 peer-checked:bg-champagne-200" />
      </span>
    </label>
  )
}

/** Editor simple de listas de texto (chips). */
export function TagInput({
  value,
  onChange,
  placeholder,
  prefix = '',
  disabled,
}: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  prefix?: string
  disabled?: boolean
}) {
  function add(raw: string) {
    const parts = raw.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean)
    if (!parts.length) return
    const next = [...value]
    for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p)
    onChange(next)
  }
  return (
    <div className={cn(control, 'flex min-h-11 flex-wrap items-center gap-1.5 py-2')}>
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-champagne-100 px-2.5 py-0.5 text-[0.8rem] text-cocoa-700">
          {prefix}
          {v}
          {!disabled && (
            <button
              type="button"
              aria-label={`Quitar ${v}`}
              className="ml-0.5 text-cocoa-400 hover:text-rose-600"
              onClick={() => onChange(value.filter((x) => x !== v))}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          className="min-w-[8rem] flex-1 bg-transparent text-[0.9rem] outline-none placeholder:text-cocoa-400/80"
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add((e.target as HTMLInputElement).value)
              ;(e.target as HTMLInputElement).value = ''
            } else if (e.key === 'Backspace' && !(e.target as HTMLInputElement).value && value.length) {
              onChange(value.slice(0, -1))
            }
          }}
          onBlur={(e) => {
            add(e.target.value)
            e.target.value = ''
          }}
          onPaste={(e) => {
            const t = e.clipboardData.getData('text')
            if (/[,\n]/.test(t)) {
              e.preventDefault()
              add(t)
            }
          }}
        />
      )}
    </div>
  )
}
