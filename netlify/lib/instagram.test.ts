import { describe, expect, it } from 'vitest'
import { buildCaption } from './instagram'

describe('buildCaption', () => {
  it('agrega hashtags al final', () => {
    expect(buildCaption('Hola ', ['AvoraTravel', '#Viajes'])).toBe('Hola\n\n#AvoraTravel #Viajes')
  })
  it('respeta el máximo de Instagram', () => {
    expect(buildCaption('x'.repeat(2300), []).length).toBe(2200)
  })
})
