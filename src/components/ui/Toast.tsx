import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { cn } from './cn'

type Kind = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  kind: Kind
  message: string
}

const ToastContext = createContext<(kind: Kind, message: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((kind: Kind, message: string) => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { id, kind, message }])
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 3800)
  }, [])
  const icons = { success: CheckCircle2, error: AlertTriangle, info: Info }
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6">
        {items.map((t) => {
          const Icon = icons[t.kind]
          return (
            <div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className={cn(
                'pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-lift ring-1 animate-fade-in',
                t.kind === 'error' ? 'bg-rose-100 text-rose-600 ring-rose-100' : 'bg-cocoa-800 text-cream-50 ring-cocoa-700',
              )}
            >
              <Icon className={cn('mt-0.5 size-4 shrink-0', t.kind !== 'error' && 'text-champagne-300')} strokeWidth={1.75} />
              <span>{t.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const push = useContext(ToastContext)
  return {
    success: (m: string) => push('success', m),
    error: (m: string) => push('error', m),
    info: (m: string) => push('info', m),
  }
}
