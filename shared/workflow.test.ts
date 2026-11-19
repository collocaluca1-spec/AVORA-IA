import { describe, expect, it } from 'vitest'
import { availableTransitions, canTransition, TRANSITIONS } from './workflow'

describe('flujo de aprobación', () => {
  it('nada llega a publicado sin pasar por aprobado y programado', () => {
    const into = (s: string) => TRANSITIONS.filter((t) => t.to === s).map((t) => t.from)
    expect(into('published')).toEqual(['publishing'])
    expect(into('publishing')).toEqual(['scheduled'])
    expect(into('scheduled')).toEqual(['approved'])
    expect(into('approved')).toEqual(['pending_approval', 'scheduled'])
  })
  it('solo admin aprueba o rechaza', () => {
    expect(canTransition('pending_approval', 'approved', 'editor')).toBe(false)
    expect(canTransition('pending_approval', 'approved', 'admin')).toBe(true)
    expect(canTransition('pending_approval', 'rejected', 'editor')).toBe(false)
  })
  it('el panel nunca publica', () => {
    expect(availableTransitions('scheduled', 'admin').map((t) => t.to)).not.toContain('publishing')
  })
})
