import { describe, expect, it } from 'vitest'
import { nextMonday, weekSlots, zonedToUtc } from './weekSlots'

const TZ = 'America/Argentina/Buenos_Aires'

describe('weekSlots', () => {
  it('convierte hora de Argentina a UTC (UTC−3)', () => {
    expect(zonedToUtc('2026-11-23', '09:30', TZ).toISOString()).toBe('2026-11-23T12:30:00.000Z')
  })

  it('el próximo lunes desde un jueves', () => {
    expect(nextMonday(new Date('2026-11-19T15:00:00Z'), TZ)).toBe('2026-11-23')
    // lunes → el lunes siguiente
    expect(nextMonday(new Date('2026-11-23T15:00:00Z'), TZ)).toBe('2026-11-30')
  })

  it('reparte según la frecuencia dentro de la semana', () => {
    const slots = weekSlots({
      weekStart: '2026-11-23',
      perWeek: { post_portrait: 3, carousel: 1, story: 5, reel: 2 },
      preferredTimes: ['09:30', '13:00', '19:30'],
      timeZone: TZ,
    })
    expect(slots).toHaveLength(11)
    for (const s of slots) {
      expect(s.localDate >= '2026-11-23' && s.localDate <= '2026-11-29').toBe(true)
      expect(['09:30', '13:00', '19:30']).toContain(s.localTime)
    }
    const stories = slots.filter((s) => s.format === 'story').map((s) => s.localDate)
    expect(new Set(stories).size).toBe(5) // nunca dos historias el mismo día
    expect([...slots].sort((a, b) => a.at.localeCompare(b.at))).toEqual(slots)
  })

  it('descuenta lo ya planificado', () => {
    const slots = weekSlots({ weekStart: '2026-11-23', perWeek: { reel: 2, story: 1 }, preferredTimes: ['10:00'], timeZone: TZ, existing: { reel: 2 } })
    expect(slots.map((s) => s.format)).toEqual(['story'])
  })

  it('ignora horarios inválidos', () => {
    const slots = weekSlots({ weekStart: '2026-11-23', perWeek: { post_square: 1 }, preferredTimes: ['25:00', 'x'], timeZone: TZ })
    expect(slots[0].localTime).toBe('10:00')
  })
})
