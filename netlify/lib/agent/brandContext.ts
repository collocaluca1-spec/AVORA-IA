import type { SupabaseClient } from '@supabase/supabase-js'
import { planningContext } from '../../../shared/agent/seasons.ts'

export interface BrandContext {
  system: string
  avoidRepeatDays: number
  excluded: string[]
}

/** Arma las instrucciones del agente a partir de la configuración guardada en Supabase. */
export async function loadBrandContext(db: SupabaseClient): Promise<BrandContext> {
  const { data } = await db.from('app_settings').select('key, value').in('key', ['brand_identity', 'content_preferences'])
  const get = (k: string) => (data?.find((r) => r.key === k)?.value ?? {}) as Record<string, any>
  const brand = get('brand_identity')
  const prefs = get('content_preferences')
  const plan = planningContext(new Date())

  const lines = [
    `Sos el agente de contenido de ${brand.brand_name ?? 'AVORA TRAVEL'}, una agencia de viajes argentina.`,
    `Tono de marca: ${brand.tone ?? 'elegante, cálido y cercano'}.`,
    ...(brand.voice_rules ?? []).map((r: string) => `- ${r}`),
    brand.banned_words?.length ? `Nunca uses estas palabras: ${brand.banned_words.join(', ')}.` : '',
    prefs.audience ? `Audiencia: ${prefs.audience}.` : '',
    prefs.content_pillars?.length ? `Pilares de contenido: ${prefs.content_pillars.join(', ')}.` : '',
    prefs.focus_destinations?.length ? `Destinos prioritarios: ${prefs.focus_destinations.join(', ')}.` : '',
    prefs.excluded_destinations?.length ? `No propongas: ${prefs.excluded_destinations.join(', ')}.` : '',
    `Fecha actual: ${plan.today} (en Argentina es ${plan.currentSeasonArgentina}). Para vender con anticipación, pensá en ${plan.targetDate}: ${plan.targetSeasonSouth} en el hemisferio sur y ${plan.targetSeasonNorth} en el norte.`,
    'REGLAS OBLIGATORIAS:',
    '- No inventes precios, tarifas, descuentos ni disponibilidad. Si un dato comercial no viene de una fuente verificable provista, no lo incluyas.',
    '- Toda afirmación factual sobre un destino (clima, eventos, requisitos) debe venir con su fuente (URL) en el campo "sources".',
    '- Escribí en español rioplatense, sin clichés ni superlativos vacíos.',
    '- Respondé solo con JSON válido según la forma pedida.',
  ]
  return {
    system: lines.filter(Boolean).join('\n'),
    avoidRepeatDays: Number(prefs.avoid_repeat_days ?? 45),
    excluded: prefs.excluded_destinations ?? [],
  }
}
