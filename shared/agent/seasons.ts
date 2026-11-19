/**
 * Estaciones astronómicas aproximadas por hemisferio. Lógica determinística
 * (no requiere IA) que el agente usa como contexto para recomendar destinos.
 */
export type Season = 'verano' | 'otoño' | 'invierno' | 'primavera'
export type Hemisphere = 'sur' | 'norte'

const OPPOSITE: Record<Season, Season> = { verano: 'invierno', invierno: 'verano', otoño: 'primavera', primavera: 'otoño' }

export function seasonFor(date: Date, hemisphere: Hemisphere = 'sur'): Season {
  const m = date.getMonth() + 1
  const d = date.getDate()
  const md = m * 100 + d
  let s: Season
  if (md >= 1221 || md < 321) s = 'verano'
  else if (md < 621) s = 'otoño'
  else if (md < 923) s = 'invierno'
  else s = 'primavera'
  return hemisphere === 'sur' ? s : OPPOSITE[s]
}

/**
 * Los viajes se venden con anticipación: por defecto el contenido apunta a la
 * temporada que empieza dentro de ~90 días.
 */
export function planningContext(today: Date, leadDays = 90) {
  const target = new Date(today.getTime() + leadDays * 86_400_000)
  return {
    today: today.toISOString().slice(0, 10),
    currentSeasonArgentina: seasonFor(today, 'sur'),
    targetDate: target.toISOString().slice(0, 10),
    targetSeasonSouth: seasonFor(target, 'sur'),
    targetSeasonNorth: seasonFor(target, 'norte'),
  }
}
