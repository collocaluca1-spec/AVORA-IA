import { describe, expect, it } from 'vitest'
import { extractJSON, keepRetrievedSources } from './anthropic'

describe('anthropic helpers', () => {
  it('extrae JSON con o sin bloque de código', () => {
    expect(extractJSON('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(extractJSON('Acá va: {"b":[1,2]} listo')).toEqual({ b: [1, 2] })
    expect(() => extractJSON('sin json')).toThrow()
  })

  it('solo conserva fuentes realmente consultadas', () => {
    const retrieved = new Map([['https://ejemplo.com/clima', { url: 'https://ejemplo.com/clima/', title: 'Clima' }]])
    const out = keepRetrievedSources(
      [
        { url: 'https://ejemplo.com/clima', title: '' },
        { url: 'https://inventada.com/nada', title: 'Falsa' },
        { url: 'https://EJEMPLO.com/clima/#x', title: 'Duplicada' },
      ],
      retrieved,
    )
    expect(out).toEqual([{ url: 'https://ejemplo.com/clima/', title: 'Clima' }])
  })
})
