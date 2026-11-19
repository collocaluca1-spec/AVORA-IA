import { mentionsPrice } from '../../../shared/contentChecks.ts'
import { repetitionReason } from '../../../shared/agent/dedupe.ts'
import { HttpError } from '../http.ts'
import { logServer, supabaseAdmin } from '../supabaseAdmin.ts'
import { loadBrandContext } from './brandContext.ts'
import { resolveTextProvider } from './providers.ts'
import { TASKS, type AgentTask } from './tasks.ts'

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || null

/**
 * Ejecuta una tarea del agente. Si no hay proveedor configurado, corta ANTES de
 * crear nada y devuelve 503 "not_configured": nunca se generan resultados falsos.
 */
export async function runAgentTask(task: AgentTask, input: Record<string, unknown>, userId: string) {
  const def = TASKS[task]
  const invalid = def.validate(input)
  if (invalid) throw new HttpError(400, 'invalid_input', invalid)

  const { provider, reason } = resolveTextProvider()
  if (!provider) throw new HttpError(503, 'not_configured', reason ?? 'IA no configurada.')
  if (def.needsWebSources && !provider.supportsWebSources)
    throw new HttpError(503, 'not_configured', 'Esta tarea requiere un proveedor con búsqueda web y citas de fuentes.')

  const db = supabaseAdmin()
  const ctx = await loadBrandContext(db)
  const { data: recent } = await db.rpc('recent_topics', { p_days: ctx.avoidRepeatDays })
  const recentTopics = ((recent ?? []) as { topic_key: string }[]).map((r) => r.topic_key)

  const { data: run, error } = await db
    .from('agent_runs')
    .insert({ task, status: 'running', input, provider: provider.name, requested_by: userId })
    .select('id')
    .single()
  if (error) throw error

  try {
    const output = (await provider.generateJSON({
      system: ctx.system,
      prompt: `${def.prompt(input, { ...ctx, recentTopics })}\n\nForma de la respuesta:\n${def.schemaHint}`,
      schemaHint: def.schemaHint,
      needsWebSources: def.needsWebSources,
    })) as Record<string, any>

    const sources = Array.isArray(output?.sources) ? output.sources : []
    if (def.needsWebSources && sources.length === 0) throw new Error('La respuesta no incluyó fuentes verificables; se descarta.')

    let saved = 0
    if (task === 'propose_ideas' && Array.isArray(output.ideas)) {
      const { data: recentTitles } = await db
        .from('content_items')
        .select('title, topic_key')
        .gte('created_at', new Date(Date.now() - ctx.avoidRepeatDays * 86_400_000).toISOString())
      for (const idea of output.ideas) {
        if (!idea?.title) continue
        const topic_key = slug(idea.destination || idea.title)
        if (repetitionReason({ topic_key, title: idea.title }, recentTitles ?? [])) continue
        if (ctx.excluded.some((x) => slug(x) === topic_key)) continue
        if (mentionsPrice(`${idea.title} ${idea.rationale ?? ''}`)) continue // sin precios inventados
        await db.from('content_ideas').insert({
          title: idea.title,
          destination: idea.destination ?? null,
          angle: idea.angle ?? null,
          suggested_format: idea.suggested_format ?? null,
          season: idea.season ?? null,
          rationale: idea.rationale ?? null,
          topic_key,
          sources: idea.sources ?? sources,
          origin: 'agent',
          agent_run_id: run.id,
          created_by: userId,
        })
        saved++
      }
    }

    await db.from('agent_runs').update({ status: 'succeeded', output, sources, finished_at: new Date().toISOString() }).eq('id', run.id)
    await logServer('agent.succeeded', `Agente: ${task}`, { actorId: userId, entityType: 'agent_run', entityId: run.id, details: { saved } })
    return { run_id: run.id, output, saved }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db.from('agent_runs').update({ status: 'failed', error: message, finished_at: new Date().toISOString() }).eq('id', run.id)
    await logServer('agent.failed', `Agente: ${task} falló`, { level: 'error', actorId: userId, entityType: 'agent_run', entityId: run.id, details: { message } })
    throw new HttpError(502, 'agent_failed', message)
  }
}
