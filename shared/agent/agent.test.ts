import { describe, expect, it } from 'vitest'
import { seasonFor } from './seasons'
import { repetitionReason, jaccard } from './dedupe'

describe('estaciones', () => {
  it('hemisferio sur', () => {
    expect(seasonFor(new Date(2026, 0, 15))).toBe('verano')
    expect(seasonFor(new Date(2026, 6, 15))).toBe('invierno')
    expect(seasonFor(new Date(2026, 3, 15))).toBe('otoño')
    expect(seasonFor(new Date(2026, 9, 15))).toBe('primavera')
  })
  it('hemisferio norte es el opuesto', () => {
    expect(seasonFor(new Date(2026, 6, 15), 'norte')).toBe('verano')
  })
})

describe('repetición', () => {
  it('detecta tema y títulos similares', () => {
    expect(repetitionReason({ topic_key: 'bariloche', title: 'x' }, [{ topic_key: 'bariloche' }])).toMatch(/ya se usó/)
    expect(jaccard('Cinco playas secretas de Brasil', 'Playas secretas de Brasil')).toBeGreaterThan(0.6)
    expect(repetitionReason({ topic_key: 'mendoza', title: 'Vinos de Mendoza' }, [{ topic_key: 'salta', title: 'Salta la linda' }])).toBeNull()
  })
})
