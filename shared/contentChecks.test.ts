import { describe, expect, it } from 'vitest'
import { checkContent, mentionsPrice } from './contentChecks'
import { normalizeHashtags } from './content'

const base = {
  title: 'Bariloche',
  caption: 'Nieve y lagos',
  hashtags: ['Bariloche'],
  format: 'post_portrait' as const,
  includes_price: false,
  price_source_url: null,
  assets: [{ mime_type: 'image/jpeg', width: 1080, height: 1350 }],
}
const codes = (r: { code: string }[]) => r.map((c) => c.code)

describe('controles de contenido', () => {
  it('detecta precios en el texto', () => {
    expect(mentionsPrice('Desde US$ 1.200 por persona')).toBe(true)
    expect(mentionsPrice('Tarifa 350.000 pesos')).toBe(true)
    expect(mentionsPrice('7 noches en Bariloche')).toBe(false)
  })
  it('bloquea precios sin fuente verificable', () => {
    expect(codes(checkContent({ ...base, caption: 'Desde USD 900' }, { forSubmission: true }))).toContain('undeclared_price')
    expect(codes(checkContent({ ...base, includes_price: true }, { forSubmission: true }))).toContain('price_without_source')
    expect(codes(checkContent({ ...base, includes_price: true, price_source_url: 'https://proveedor.com/x' }, { forSubmission: true }))).not.toContain('price_without_source')
  })
  it('valida cantidad y tipo de material por formato', () => {
    expect(codes(checkContent({ ...base, format: 'carousel' }, { forSubmission: true }))).toContain('assets_missing')
    expect(codes(checkContent({ ...base, format: 'reel' }, { forSubmission: true }))).toContain('asset_type')
    expect(codes(checkContent({ ...base, assets: [{ mime_type: 'image/jpeg', width: 1080, height: 1080 }] }, { forSubmission: true }))).toContain('asset_ratio')
  })
  it('un contenido completo no tiene errores', () => {
    expect(checkContent(base, { forSubmission: true }).filter((c) => c.level === 'error')).toEqual([])
  })
  it('normaliza hashtags', () => {
    expect(normalizeHashtags('#Viajes viajes, #Patagonia!')).toEqual(['Viajes', 'Patagonia'])
  })
})
