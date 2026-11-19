import { mentionsPrice } from '../../../shared/contentChecks.ts'
import { repetitionReason } from '../../../shared/agent/dedupe.ts'
import { HttpError } from '../http.ts'
import { logServer, supabaseAdmin } from '../supabaseAdmin.ts'
import { loadBrandContext } from './brandContext.ts'
import { resolveTextProvider } from './providers.ts'
import { TASKS, type AgentTask, type RunnableTask } from './tasks.ts'
import { runWeekPlan } from './weekPlanner.ts'

export const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || null

/** Una ejecución en cola solo puede reclamarse durante este tiempo. */
const CLAIM_WINDOW_MS = 10 * 60_000

/**
 * Deja una tarea en cola (agent_runs.status = 'queued'). Si no hay proveedor
 * configurado corta ANTES de crear nada: nunca se generan resultados falsos.
 */
export async function queueAgentTask(task: RunnableTask, input: Record<string, unknown>, userId: string | null): Promise<string> {
  if (task !== 'plan_week') {
    const invalid = TASKS[task].validate(input)
    if (invalid) throw new HttpError(400, 'invalid_input', invalid)
  }
  const { provider, reason } = resolveTextProvider()
  if (!provider) throw new HttpError(503, 'not_configured', reason ?? 'IA no configurada.')

  const db = supabaseAdmin()
  if (task === 'plan_week') {
    const { data: busy } = await db
      .from('agent_runs')
      .select('id')
      .eq('task', 'plan_week')
      .in('status', ['queued', 'running'])
      .gte('created_at', new Date(Date.now() - 20 * 60_000).toISOString())
      .limit(1)
    if (busy?.length) throw new HttpError(409, 'already_running', 'El agente ya está armando la semana. Esperá a que termine.')
  }
  const { data, error } = await db
    .from('agent_runs')
    .insert({ task, status: 'queued', input, provider: provider.name, requested_by: userId })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

/** Llama a la función en segundo plano que procesa la cola (hasta 15 min). */
export async function dispatchRun(siteOrigin: string, runId: string): Promise<void> {
  const res = await fetch(`${siteOrigin}/api/agent-run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ run_id: runId }),
  })
  if (res.status !== 202 && !res.ok) {
    await supabaseAdmin()
      .from('agent_runs')
      .update({ status: 'failed', error: `No se pudo iniciar la tarea (${res.status}).`, finished_at: new Date().toISOString() })
      .eq('id', runId)
    throw new HttpError(502, 'dispatch_failed', 'No se pudo iniciar la tarea en segundo plano.')
  }
}

/**
 * Ejecuta una tarea en cola. Solo procesa ejecuciones 'queued' recientes y las
 * reclama de forma atómica, así una llamada repetida o ajena no hace nada.
 */
export async function executeQueuedRun(runId: string): Promise<void> {
  const db = supabaseAdmin()
  const { data: run } = await db
    .from('agent_runs')
    .update({ status: 'running' })
    .eq('id', runId)
    .eq('status', 'queued')
    .gte('created_at', new Date(Date.now() - CLAIM_WINDOW_MS).toISOString())
    .select('id, task, input, requested_by')
    .maybeSingle()
  if (!run) return

  const userId = (run.requested_by as string | null) ?? undefined
  try {
    const output =
      run.task === 'plan_week'
        ? await runWeekPlan(run.id, (run.input ?? {}) as Record<string, unknown>, userId ?? null)
        : await runTask(run.id, run.task as AgentTask, (run.input ?? {}) as Record<string, unknown>, userId ?? null)
    await db
      .from('agent_runs')
      .update({ status: 'succeeded', output, sources: (output as any)?.sources ?? [], finished_at: new Date().toISOString() })
      .eq('id', run.id)
    await logServer('agent.succeeded', `Agente: ${run.task}`, { actorId: userId, entityType: 'agent_run', entityId: run.id, details: { summary: (output as any)?.summary ?? null } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db.from('agent_runs').update({ status: 'failed', error: message, finished_at: new Date().toISOString() }).eq('id', run.id)
    await logServer('agent.failed', `Agente: ${run.task} falló`, { level: 'error', actorId: userId, entityType: 'agent_run', entityId: run.id, details: { message } })
  }
}

async function runTask(runId: string, task: AgentTask, input: Record<string, unknown>, userId: string | null) {
  const def = TASKS[task]
  const { provider } = resolveTextProvider()
  if (!provider) throw new Error('La IA de texto no está configurada en el servidor.')

  const db = supabaseAdmin()
  const ctx = await loadBrandContext(db)
  const { data: recent } = await db.rpc('recent_topics', { p_days: ctx.avoidRepeatDays })
  const recentTopics = ((recent ?? []) as { topic_key: string }[]).map((r) => r.topic_key)

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
        sources: idea.sources?.length ? idea.sources : sources,
        origin: 'agent',
        agent_run_id: runId,
        created_by: userId,
      })
      saved++
    }
  }
  return { ...output, sources, saved }
}
