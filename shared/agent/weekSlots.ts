/**
 * Calcula los horarios de publicación de una semana a partir de la frecuencia
 * configurada (Configuración → Frecuencia). Lógica determinística y testeable.
 */
import type { ContentFormat } from '../content.ts'

export interface Slot {
  format: ContentFormat
  /** Fecha local (YYYY-MM-DD) y hora local (HH:mm) en la zona de la marca */
  localDate: string
  localTime: string
  /** Instante en UTC (ISO) */
  at: string
}

const FORMAT_ORDER: ContentFormat[] = ['reel', 'carousel', 'post_portrait', 'post_square', 'story']

/** Desfase (ms) de una zona horaria en un instante dado: local − UTC. */
function tzOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(instant / 1000) * 1000
}

/** Convierte fecha y hora locales de una zona a un instante UTC. */
export function zonedToUtc(localDate: string, localTime: string, timeZone: string): Date {
  const [y, m, d] = localDate.split('-').map(Number)
  const [hh, mm] = localTime.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const first = guess - tzOffsetMs(guess, timeZone)
  return new Date(guess - tzOffsetMs(first, timeZone))
}

/** Fecha local (YYYY-MM-DD) de un instante en una zona. */
export function localDateOf(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant)
}

function addDaysIso(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Lunes (fecha local) de la semana siguiente a `now`. */
export function nextMonday(now: Date, timeZone: string): string {
  const today = localDateOf(now, timeZone)
  const [y, m, d] = today.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = domingo
  const delta = ((8 - dow) % 7) || 7
  return addDaysIso(today, delta)
}

const isTime = (t: unknown): t is string => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t)

/** Cantidad de días desde `from` hasta el domingo inclusive (fechas locales). */
export function daysUntilSundayInclusive(from: string): number {
  const [y, m, d] = from.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = domingo
  return dow === 0 ? 1 : 8 - dow
}

export { addDaysIso }

/**
 * Reparte las piezas de cada formato en un período de `days` días (por defecto
 * una semana), proporcional a la frecuencia semanal, alternando los horarios
 * preferidos y evitando dos piezas del mismo formato el mismo día.
 * `existing` descuenta lo que ya hay planificado en el período (re-ejecución segura)
 * y `notBefore` descarta horarios que ya pasaron (para "hoy").
 */
export function weekSlots(opts: {
  weekStart: string
  days?: number
  perWeek: Partial<Record<ContentFormat, number>>
  preferredTimes: string[]
  timeZone: string
  existing?: Partial<Record<ContentFormat, number>>
  notBefore?: Date
}): Slot[] {
  const days = Math.max(1, Math.min(7, Math.floor(opts.days ?? 7)))
  const times = opts.preferredTimes.filter(isTime).sort()
  const useTimes = times.length ? times : ['10:00']
  const perDayUse = new Map<string, number>() // `${day}|${time}` → piezas
  const slots: Slot[] = []
  const minAt = opts.notBefore ? opts.notBefore.getTime() : -Infinity

  FORMAT_ORDER.forEach((format, fi) => {
    const weekly = Math.max(0, Math.min(14, Math.floor(Number(opts.perWeek[format] ?? 0))))
    const wanted = days === 7 ? weekly : Math.round((weekly * days) / 7)
    const n = Math.max(0, wanted - Math.max(0, Number(opts.existing?.[format] ?? 0)))
    const perRound = Math.min(n, days)
    for (let i = 0; i < n; i++) {
      // Distribución pareja; si hay más piezas que días, segunda vuelta en otro horario.
      const day = (Math.floor(((i % days) + 0.5) * days / Math.max(1, perRound)) + fi) % days
      const localDate = addDaysIso(opts.weekStart, day)
      const free = useTimes.filter((t) => zonedToUtc(localDate, t, opts.timeZone).getTime() > minAt)
      if (!free.length) continue // ese día ya no quedan horarios
      let best = free[(i + fi) % free.length]
      let bestUse = Infinity
      for (let k = 0; k < free.length; k++) {
        const t = free[(i + fi + k) % free.length]
        const u = perDayUse.get(`${localDate}|${t}`) ?? 0
        if (u < bestUse) {
          best = t
          bestUse = u
        }
      }
      perDayUse.set(`${localDate}|${best}`, bestUse + 1)
      slots.push({ format, localDate, localTime: best, at: zonedToUtc(localDate, best, opts.timeZone).toISOString() })
    }
  })

  return slots.sort((a, b) => a.at.localeCompare(b.at))
}
