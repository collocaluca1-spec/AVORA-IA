import { cn } from '../ui/cn'

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <svg viewBox="0 0 40 40" className="size-9 shrink-0" aria-hidden>
        <circle cx="20" cy="20" r="19" fill="none" stroke="url(#g)" strokeWidth="1" />
        <path d="M20 9 L29.5 31 H25.8 L23.7 25.8 H16.3 L14.2 31 H10.5 Z M17.5 22.7 H22.5 L20 16.3 Z" fill="url(#g)" />
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e9d9b5" />
            <stop offset="1" stopColor="#b8955a" />
          </linearGradient>
        </defs>
      </svg>
      <div className="leading-none">
        <p className={cn('font-display text-[1.35rem] tracking-[0.18em]', light ? 'text-cream-50' : 'text-cocoa-900')}>AVORA</p>
        <p className="mt-1 text-[0.58rem] uppercase tracking-[0.42em] text-champagne-300">AI · Studio</p>
      </div>
    </div>
  )
}
