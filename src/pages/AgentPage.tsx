import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Compass, Lightbulb, PenTool, Map, Sun, Plus, Trash2, ArrowRight, Leaf, CalendarRange } from 'lucide-react'
import { CONTENT_FORMATS, FORMAT_SPECS, type ContentFormat } from '@shared/content'
import { planningContext } from '@shared/agent/seasons'
import { listIntegrations, getSetting } from '@/lib/api/settings'
import { createIdea, deleteIdea, listAgentRuns, listIdeas, recentTopics, updateIdea } from '@/lib/api/ideas'
import { runAgent, type AgentTask } from '@/lib/api/agent'
import { useAsync } from '@/hooks/useAsync'
import { friendlyError } from '@/lib/supabase'
import { topicKey } from '@/lib/text'
import { fmt, relative } from '@/lib/dates'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { IntegrationStatusPill } from '@/components/content/IntegrationStatusPill'
import { FormatIcon } from '@/components/content/FormatIcon'
import { cn } from '@/components/ui/cn'

const TASK_TITLES: Partial<Record<AgentTask, string>> = { plan_week: 'Planificación de contenido' }

const CAPABILITIES: { task: AgentTask; title: string; desc: string; icon: typeof Bot; field?: { key: string; label: string; placeholder: string } }[] = [
  { task: 'research_destination', title: 'Investigar destinos', desc: 'Mejor época, experiencias y ángulos de contenido, con fuentes citadas.', icon: Compass, field: { key: 'destination', label: 'Destino', placeholder: 'Ej.: Jujuy' } },
  { task: 'propose_ideas', title: 'Proponer ideas', desc: 'Ideas variadas que evitan temas usados recientemente.', icon: Lightbulb, field: { key: 'focus', label: 'Foco (opcional)', placeholder: 'Ej.: escapadas de fin de semana' } },
  { task: 'write_copy', title: 'Textos comerciales', desc: 'Descripción y hashtags con el tono de Avora, sin precios inventados.', icon: PenTool, field: { key: 'brief', label: 'Brief', placeholder: 'Ej.: Reel de glaciares en El Calafate' } },
  { task: 'travel_tips', title: 'Consejos de viaje', desc: 'Consejos prácticos y verificables.', icon: Map, field: { key: 'topic', label: 'Tema', placeholder: 'Ej.: qué llevar a Europa en invierno' } },
  { task: 'seasonal_recommendations', title: 'Según temporada', desc: 'Destinos recomendados para la próxima temporada.', icon: Sun, field: { key: 'period', label: 'Período (opcional)', placeholder: 'Ej.: vacaciones de invierno' } },
]

export default function AgentPage() {
  const toast = useToast()
  const integrations = useAsync(listIntegrations, [])
  const prefs = useAsync(() => getSetting('content_preferences'), [])
  const days = prefs.data?.avoid_repeat_days ?? 45
  const topics = useAsync(() => recentTopics(days), [days])
  const ideas = useAsync(listIdeas, [])
  const runs = useAsync(listAgentRuns, [])
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<AgentTask | null>(null)
  const [newIdea, setNewIdea] = useState(false)
  const [period, setPeriod] = useState('today_plus_3_weeks')

  const ai = integrations.data?.find((i) => i.key === 'ai_text')
  const aiReady = ai && ai.status !== 'not_configured' && ai.status !== 'disabled'
  const stock = integrations.data?.find((i) => i.key === 'stock_media')
  const plan = planningContext(new Date())

  async function run(task: AgentTask, key?: string, extra?: Record<string, unknown>) {
    setBusy(task)
    if (task === 'plan_week') toast.success('El agente está armando el contenido. Puede tardar varios minutos (unos 3 por semana); podés seguir usando el panel.')
    const r = await runAgent(task, extra ?? (key ? { [key]: inputs[task] ?? '' } : {}))
    setBusy(null)
    r.ok ? toast.success(r.message) : toast.error(r.message)
    ideas.reload()
    runs.reload()
  }

  return (
    <>
      <PageHeader
        eyebrow="Inteligencia artificial"
        title="Agente de contenido"
        description="Investiga destinos, propone ideas y redacta textos con la identidad de Avora. Todo lo que genere queda pendiente de tu aprobación."
      />

      <Card className="mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-full bg-cocoa-800 text-champagne-300">
            <Bot className="size-5" strokeWidth={1.5} />
          </span>
          <div>
            <p className="text-[0.95rem] text-cocoa-800">Motor de IA de texto</p>
            <p className="text-xs text-cocoa-500">
              {aiReady ? 'Hay credenciales en el servidor. Las tareas se ejecutan del lado del servidor.' : 'Sin proveedor configurado: las tareas automáticas están deshabilitadas. Podés usar el banco de ideas manualmente.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {ai && <IntegrationStatusPill status={ai.status} />}
          <ButtonLink to="/configuracion/integraciones-ia" variant="secondary" size="sm">
            Configurar
          </ButtonLink>
        </div>
      </Card>

      <Card className="mb-6 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-cocoa-800 text-champagne-300">
              <CalendarRange className="size-5" strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <p className="text-[0.95rem] text-cocoa-800">Planificación automática</p>
              <p className="text-xs text-cocoa-500">
                El agente investiga destinos con fuentes, escribe textos y hashtags, busca fotos y videos reales y lo agenda todo como
                pendiente de aprobación. Además, cada jueves a las 9:00 arma solo la semana siguiente.
              </p>
              {stock && stock.status !== 'connected' && (
                <p className="mt-1 text-xs text-gold-600">Banco de fotos sin conectar: las piezas se crearán sin imagen.</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Período a planificar" disabled={!aiReady || busy !== null}>
              <option value="rest_of_week">Resto de esta semana (desde hoy)</option>
              <option value="next_week">La semana que viene</option>
              <option value="next_2_weeks">Las próximas 2 semanas</option>
              <option value="next_3_weeks">Las próximas 3 semanas</option>
              <option value="today_plus_3_weeks">Desde hoy + 3 semanas</option>
            </Select>
            <Button size="sm" disabled={!aiReady || busy !== null} loading={busy === 'plan_week'} onClick={() => run('plan_week', undefined, { period })}>
              {aiReady ? 'Armar contenido' : 'Requiere IA configurada'}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CAPABILITIES.map((c) => (
          <Card key={c.task} className={cn('flex flex-col p-5', !aiReady && 'opacity-80')}>
            <c.icon className="mb-3 size-5 text-gold-500" strokeWidth={1.5} />
            <h3 className="text-xl">{c.title}</h3>
            <p className="mb-4 text-xs text-cocoa-500">{c.desc}</p>
            {c.field && (
              <Input
                className="mb-3"
                placeholder={c.field.placeholder}
                aria-label={c.field.label}
                value={inputs[c.task] ?? ''}
                onChange={(e) => setInputs((s) => ({ ...s, [c.task]: e.target.value }))}
                disabled={!aiReady}
              />
            )}
            <Button className="mt-auto" size="sm" variant={aiReady ? 'primary' : 'secondary'} disabled={!aiReady} loading={busy === c.task} onClick={() => run(c.task, c.field?.key)}>
              {aiReady ? 'Ejecutar' : 'Requiere IA configurada'}
            </Button>
          </Card>
        ))}
        <Card className="flex flex-col bg-cocoa-800 p-5 text-cream-50 ring-cocoa-700">
          <Leaf className="mb-3 size-5 text-champagne-300" strokeWidth={1.5} />
          <h3 className="text-xl text-cream-50">Contexto de temporada</h3>
          <p className="mb-4 text-xs text-cream-200/70">Calculado automáticamente; el agente lo usa para planificar.</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2"><dt className="text-cream-200/70">Hoy en Argentina</dt><dd className="capitalize">{plan.currentSeasonArgentina}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-cream-200/70">Vender para</dt><dd>{fmt(plan.targetDate + 'T12:00:00', "d 'de' MMMM")}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-cream-200/70">Hemisferio sur</dt><dd className="capitalize">{plan.targetSeasonSouth}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-cream-200/70">Hemisferio norte</dt><dd className="capitalize">{plan.targetSeasonNorth}</dd></div>
          </dl>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            eyebrow="Banco de ideas"
            title="Ideas para publicar"
            action={
              <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={() => setNewIdea(true)}>
                Agregar idea
              </Button>
            }
          />
          <div className="space-y-2.5 p-4 sm:p-6">
            {(ideas.data ?? []).filter((i) => i.status !== 'discarded').length ? (
              ideas.data!
                .filter((i) => i.status !== 'discarded')
                .map((i) => (
                  <div key={i.id} className="flex flex-col gap-3 rounded-2xl bg-cream-100/60 p-4 ring-1 ring-cream-200 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-cocoa-500">
                        {i.suggested_format && (
                          <span className="inline-flex items-center gap-1"><FormatIcon format={i.suggested_format} className="size-3.5" /> {FORMAT_SPECS[i.suggested_format].shortLabel}</span>
                        )}
                        {i.origin === 'agent' && <span className="text-gold-600">Agente</span>}
                        {i.status === 'used' && <span className="rounded-full bg-sage-100 px-2 text-sage-600">Usada</span>}
                      </div>
                      <p className="font-display text-lg leading-snug text-cocoa-900">{i.title}</p>
                      <p className="text-xs text-cocoa-500">{[i.destination, i.angle, i.season].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {i.status !== 'used' ? (
                        <ButtonLink to={`/estudio?idea=${i.id}`} size="sm" icon={<ArrowRight className="size-3.5" />}>
                          Crear contenido
                        </ButtonLink>
                      ) : (
                        i.content_id && <ButtonLink to={`/estudio/${i.content_id}`} size="sm" variant="secondary">Ver contenido</ButtonLink>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Descartar"
                        onClick={async () => {
                          try {
                            if (i.origin === 'agent') await updateIdea(i.id, { status: 'discarded' })
                            else await deleteIdea(i.id)
                            ideas.reload()
                          } catch (e) {
                            toast.error(friendlyError(e))
                          }
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
            ) : (
              <EmptyState icon={<Lightbulb className="size-6" strokeWidth={1.25} />} title="Sin ideas todavía" description="Agregá ideas a mano. Cuando la IA esté conectada, el agente también las propondrá acá." className="py-8" />
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader eyebrow={`Últimos ${days} días`} title="Temas usados" />
            <div className="flex flex-wrap gap-2 p-5 sm:p-6">
              {(topics.data ?? []).length ? (
                topics.data!.map((t) => (
                  <span key={t.topic_key} className="rounded-full bg-champagne-100 px-3 py-1 text-xs text-cocoa-700 ring-1 ring-champagne-200" title={`Último uso ${relative(t.last_used)}`}>
                    {t.destination || t.topic_key} {t.uses > 1 && <span className="text-cocoa-400">×{t.uses}</span>}
                  </span>
                ))
              ) : (
                <p className="text-sm text-cocoa-400">Todavía no hay temas registrados. El agente los usará para no repetir contenido.</p>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader eyebrow="Historial" title="Ejecuciones del agente" />
            <ul className="space-y-2 p-5 sm:p-6">
              {(runs.data ?? []).length ? (
                runs.data!.map((r) => (
                  <li key={r.id} className="flex justify-between gap-3 text-sm">
                    <span className="text-cocoa-700">{CAPABILITIES.find((c) => c.task === r.task)?.title ?? TASK_TITLES[r.task as AgentTask] ?? r.task}</span>
                    <span className={cn('text-xs', r.status === 'failed' ? 'text-rose-600' : 'text-cocoa-500')}>{r.status} · {relative(r.created_at)}</span>
                  </li>
                ))
              ) : (
                <p className="text-sm text-cocoa-400">Sin ejecuciones.</p>
              )}
            </ul>
          </Card>
        </div>
      </div>

      <NewIdeaModal open={newIdea} onClose={() => setNewIdea(false)} onSaved={ideas.reload} />
      <p className="mt-8 text-center text-xs text-cocoa-400">
        Las ideas no se publican: se convierten en borradores en el <Link to="/estudio" className="underline">Estudio</Link> y pasan por aprobación.
      </p>
    </>
  )
}

function NewIdeaModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ title: '', destination: '', angle: '', suggested_format: '' as ContentFormat | '', season: '', rationale: '' })
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    try {
      await createIdea({
        title: f.title.trim(),
        destination: f.destination.trim() || null,
        angle: f.angle.trim() || null,
        suggested_format: f.suggested_format || null,
        season: f.season.trim() || null,
        rationale: f.rationale.trim() || null,
        topic_key: topicKey(f.destination || f.title),
      })
      toast.success('Idea guardada.')
      setF({ title: '', destination: '', angle: '', suggested_format: '', season: '', rationale: '' })
      onSaved()
      onClose()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Banco de ideas"
      title="Nueva idea"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={busy} disabled={!f.title.trim()}>Guardar idea</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Idea" className="sm:col-span-2">
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ej.: 5 pueblos de la Quebrada de Humahuaca" autoFocus />
        </Field>
        <Field label="Destino">
          <Input value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })} />
        </Field>
        <Field label="Formato sugerido">
          <Select value={f.suggested_format} onChange={(e) => setF({ ...f, suggested_format: e.target.value as ContentFormat })}>
            <option value="">Sin definir</option>
            {CONTENT_FORMATS.map((x) => <option key={x} value={x}>{FORMAT_SPECS[x].label}</option>)}
          </Select>
        </Field>
        <Field label="Enfoque">
          <Input value={f.angle} onChange={(e) => setF({ ...f, angle: e.target.value })} placeholder="Gastronomía, aventura…" />
        </Field>
        <Field label="Temporada">
          <Input value={f.season} onChange={(e) => setF({ ...f, season: e.target.value })} />
        </Field>
        <Field label="Por qué" className="sm:col-span-2">
          <Textarea rows={3} value={f.rationale} onChange={(e) => setF({ ...f, rationale: e.target.value })} />
        </Field>
      </div>
    </Modal>
  )
}
