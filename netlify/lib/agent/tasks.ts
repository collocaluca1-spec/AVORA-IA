import type { BrandContext } from './brandContext.ts'

export const AGENT_TASKS = [
  'research_destination',
  'propose_ideas',
  'write_copy',
  'travel_tips',
  'seasonal_recommendations',
] as const
export type AgentTask = (typeof AGENT_TASKS)[number]
/** Tareas que se pueden encolar: las anteriores más la planificación semanal */
export const RUNNABLE_TASKS = [...AGENT_TASKS, 'plan_week'] as const
export type RunnableTask = (typeof RUNNABLE_TASKS)[number]

export interface TaskDef {
  needsWebSources: boolean
  validate(input: Record<string, unknown>): string | null
  prompt(input: Record<string, unknown>, ctx: BrandContext & { recentTopics: string[] }): string
  schemaHint: string
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const SOURCES = '"sources": [{ "url": string, "title": string }]'

export const TASKS: Record<AgentTask, TaskDef> = {
  research_destination: {
    needsWebSources: true,
    validate: (i) => (str(i.destination) ? null : 'Indicá un destino.'),
    prompt: (i) => `Investigá el destino "${str(i.destination)}" para contenido de Instagram: mejor época, experiencias distintivas, consejos prácticos y ángulos de contenido.`,
    schemaHint: `{ "summary": string, "best_time": string, "highlights": string[], "practical_tips": string[], "content_angles": string[], ${SOURCES} }`,
  },
  propose_ideas: {
    needsWebSources: true,
    validate: (i) => (Number(i.count ?? 5) > 0 && Number(i.count ?? 5) <= 12 ? null : 'Pedí entre 1 y 12 ideas.'),
    prompt: (i, ctx) =>
      `Proponé ${Number(i.count ?? 5)} ideas de publicaciones${str(i.focus) ? ` con foco en ${str(i.focus)}` : ''}. ` +
      `Variá formatos (post_portrait, post_square, story, reel, carousel). ` +
      (ctx.recentTopics.length ? `Evitá estos temas usados recientemente: ${ctx.recentTopics.join(', ')}.` : ''),
    schemaHint: `{ "ideas": [{ "title": string, "destination": string, "angle": string, "suggested_format": "post_portrait"|"post_square"|"story"|"reel"|"carousel", "season": string, "rationale": string, ${SOURCES} }] }`,
  },
  write_copy: {
    needsWebSources: false,
    validate: (i) => (str(i.brief) ? null : 'Describí el contenido a redactar.'),
    prompt: (i) => `Redactá la descripción de Instagram (máx. 1800 caracteres) y hasta 15 hashtags para: ${str(i.brief)}. Formato: ${str(i.format) || 'post_portrait'}.`,
    schemaHint: `{ "title": string, "caption": string, "hashtags": string[] }`,
  },
  travel_tips: {
    needsWebSources: true,
    validate: (i) => (str(i.topic) ? null : 'Indicá el tema de los consejos.'),
    prompt: (i) => `Escribí 5 consejos de viaje útiles y verificables sobre: ${str(i.topic)}.`,
    schemaHint: `{ "tips": [{ "title": string, "body": string }], ${SOURCES} }`,
  },
  seasonal_recommendations: {
    needsWebSources: true,
    validate: () => null,
    prompt: (i) => `Recomendá 6 destinos para viajar ${str(i.period) || 'en la próxima temporada'} desde Argentina, explicando por qué es buen momento.`,
    schemaHint: `{ "destinations": [{ "destination": string, "why_now": string, "suggested_format": string }], ${SOURCES} }`,
  },
}
