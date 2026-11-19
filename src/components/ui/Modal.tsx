import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from './cn'

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  eyebrow?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-cocoa-900/35 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-cream-50 shadow-lift ring-1 ring-cream-300 sm:rounded-3xl animate-fade-in',
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-cream-200 px-6 py-5">
          <div>
            {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
            <h2 className="text-2xl leading-tight">{title}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-cocoa-500 hover:bg-cream-200" aria-label="Cerrar">
            <X className="size-5" strokeWidth={1.5} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-cream-200 bg-cream-100/60 px-6 py-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}
