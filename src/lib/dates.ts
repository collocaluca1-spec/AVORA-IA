import { format, formatDistanceToNow, isToday, isTomorrow } from 'date-fns'
import { es } from 'date-fns/locale'

export const fmt = (d: Date | string, pattern: string) =>
  format(typeof d === 'string' ? new Date(d) : d, pattern, { locale: es })

export function friendlyDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Sin fecha'
  const d = new Date(iso)
  if (isToday(d)) return `Hoy, ${fmt(d, 'HH:mm')}`
  if (isTomorrow(d)) return `Mañana, ${fmt(d, 'HH:mm')}`
  return fmt(d, "EEE d 'de' MMM, HH:mm")
}

export const relative = (iso: string) =>
  formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es })

/** Valor para <input type="datetime-local"> en hora local */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  return fmt(iso, "yyyy-MM-dd'T'HH:mm")
}

export function fromLocalInput(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString()
}
