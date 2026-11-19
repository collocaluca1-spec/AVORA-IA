import { CONTENT_FORMATS, FORMAT_SPECS, type ContentFormat } from '@shared/content'
import { cn } from '../ui/cn'

export function FormatPicker({ value, onChange, disabled }: { value: ContentFormat; onChange: (f: ContentFormat) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {CONTENT_FORMATS.map((f) => {
        const s = FORMAT_SPECS[f]
        const active = value === f
        return (
          <button
            key={f}
            type="button"
            disabled={disabled}
            onClick={() => onChange(f)}
            aria-pressed={active}
            className={cn(
              'flex flex-col items-center gap-2 rounded-2xl px-2 py-3.5 ring-1 transition disabled:cursor-not-allowed disabled:opacity-50',
              active ? 'bg-cocoa-800 text-cream-50 ring-cocoa-800 shadow-lift' : 'bg-white/70 text-cocoa-700 ring-cream-300 hover:ring-champagne-300',
            )}
          >
            <span className="flex h-11 items-end">
              <span
                className={cn('block rounded-[3px] border', active ? 'border-champagne-300 bg-champagne-300/20' : 'border-cocoa-400 bg-cream-200')}
                style={{ width: f === 'carousel' ? 22 : (s.width / s.height) * 40, height: f === 'carousel' ? 28 : 40, boxShadow: f === 'carousel' ? (active ? '5px 0 0 -1px rgba(216,191,138,.6)' : '5px 0 0 -1px #c9b596') : undefined }}
              />
            </span>
            <span className="text-[0.78rem] leading-none">{s.shortLabel}</span>
            <span className={cn('text-[0.62rem] leading-none', active ? 'text-champagne-200/80' : 'text-cocoa-400')}>
              {s.width}×{s.height}
            </span>
          </button>
        )
      })}
    </div>
  )
}
