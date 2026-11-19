import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Bot, Save, Send, AlertTriangle, ArrowLeft, Link2 } from 'lucide-react'
import { FORMAT_SPECS, normalizeHashtags, INSTAGRAM_CAPTION_MAX, type ContentFormat, type ContentAsset } from '@shared/content'
import { checkContent, hasBlockingErrors, mentionsPrice } from '@shared/contentChecks'
import { REQUIRES_REAPPROVAL_ON_EDIT, EDITABLE_STATUSES } from '@shared/workflow'
import { createContent, getContent, transitionContent, updateContent, type ContentDraft, type ContentWithAssets } from '@/lib/api/content'
import { removeAsset, reorderAssets, uploadAsset } from '@/lib/api/assets'
import { getSetting, listIntegrations } from '@/lib/api/settings'
import { listIdeas, updateIdea } from '@/lib/api/ideas'
import { friendlyError } from '@/lib/supabase'
import { fromLocalInput, toLocalInput } from '@/lib/dates'
import { topicKey } from '@/lib/text'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, Input, Textarea, TagInput, Toggle } from '@/components/ui/Field'
import { PageLoader } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { FormatPicker } from '@/components/content/FormatPicker'
import { MediaManager, entryMeta, type MediaEntry } from '@/components/content/MediaManager'
import { InstagramPreview } from '@/components/content/InstagramPreview'
import { ChecksList } from '@/components/content/ChecksList'
import { StatusBadge } from '@/components/content/StatusBadge'
import { ContentActions } from '@/components/content/ContentActions'
import { IntegrationStatusPill } from '@/components/content/IntegrationStatusPill'

interface FormState {
  title: string
  caption: string
  hashtags: string[]
  format: ContentFormat
  destination: string
  notes: string
  scheduled: string // datetime-local
  includes_price: boolean
  price_source_url: string
  price_source_note: string
}

const EMPTY: FormState = {
  title: '',
  caption: '',
  hashtags: [],
  format: 'post_portrait',
  destination: '',
  notes: '',
  scheduled: '',
  includes_price: false,
  price_source_url: '',
  price_source_note: '',
}

function fromItem(c: ContentWithAssets): FormState {
  return {
    title: c.title,
    caption: c.caption,
    hashtags: c.hashtags,
    format: c.format,
    destination: c.destination ?? '',
    notes: c.notes ?? '',
    scheduled: toLocalInput(c.scheduled_at),
    includes_price: c.includes_price,
    price_source_url: c.price_source_url ?? '',
    price_source_note: c.price_source_note ?? '',
  }
}

export default function StudioPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const toast = useToast()

  const [item, setItem] = useState<ContentWithAssets | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [media, setMedia] = useState<MediaEntry[]>([])
  const [removed, setRemoved] = useState<ContentAsset[]>([])
  const [loading, setLoading] = useState(Boolean(id))
  const [saving, setSaving] = useState<null | 'save' | 'submit'>(null)
  const [ideaId, setIdeaId] = useState<string | null>(null)
  // Si un guardado nuevo falla a mitad de camino, el reintento actualiza en vez de duplicar.
  const createdId = useRef<string | null>(null)

  const integrations = useAsync(listIntegrations, [])
  const brand = useAsync(() => getSetting('brand_identity'), [])
  const aiText = integrations.data?.find((i) => i.key === 'ai_text')

  // Carga inicial: contenido existente o valores desde la URL (?fecha, ?formato, ?idea)
  useEffect(() => {
    let alive = true
    setRemoved([])
    createdId.current = null
    if (id) {
      setLoading(true)
      getContent(id)
        .then((c) => {
          if (!alive) return
          setItem(c)
          setForm(fromItem(c))
          setMedia(c.content_assets.map((a) => ({ kind: 'existing', key: a.id, asset: a })))
        })
        .catch((e) => toast.error(friendlyError(e)))
        .finally(() => alive && setLoading(false))
    } else {
      setItem(null)
      setMedia([])
      const f = { ...EMPTY }
      const fecha = params.get('fecha')
      if (fecha) f.scheduled = toLocalInput(fecha)
      const formato = params.get('formato') as ContentFormat | null
      if (formato && formato in FORMAT_SPECS) f.format = formato
      setForm(f)
      const idea = params.get('idea')
      if (idea) {
        listIdeas().then((all) => {
          const i = all.find((x) => x.id === idea)
          if (!i || !alive) return
          setIdeaId(i.id)
          setForm((s) => ({
            ...s,
            title: i.title,
            destination: i.destination ?? '',
            format: i.suggested_format ?? s.format,
            notes: [i.angle && `Enfoque: ${i.angle}`, i.rationale].filter(Boolean).join('\n'),
          }))
        })
      }
    }
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Hashtags de marca por defecto en contenidos nuevos
  useEffect(() => {
    if (!id && brand.data?.default_hashtags?.length)
      setForm((s) => (s.hashtags.length ? s : { ...s, hashtags: normalizeHashtags(brand.data!.default_hashtags) }))
  }, [brand.data, id])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((s) => ({ ...s, [k]: v }))
  const editable = !item || EDITABLE_STATUSES.includes(item.status)
  const willNeedReapproval = item && REQUIRES_REAPPROVAL_ON_EDIT.includes(item.status)

  const checks = useMemo(
    () =>
      checkContent(
        {
          title: form.title,
          caption: form.caption,
          hashtags: form.hashtags,
          format: form.format,
          includes_price: form.includes_price,
          price_source_url: form.price_source_url || null,
          scheduled_at: fromLocalInput(form.scheduled),
          assets: media.map(entryMeta),
        },
        { forSubmission: true },
      ),
    [form, media],
  )
  const priceDetected = mentionsPrice(`${form.title} ${form.caption}`)
  const captionLength = form.caption.length + form.hashtags.reduce((n, h) => n + h.length + 2, 0) + 2

  async function save(submit: boolean) {
    if (!form.title.trim()) return toast.error('El título es obligatorio.')
    if (submit && hasBlockingErrors(checks)) return toast.error('Resolvé los puntos marcados antes de enviar a aprobación.')
    if (form.includes_price && hasBlockingErrors(checks.filter((c) => c.code === 'price_without_source')))
      return toast.error('Falta la fuente verificable del precio.')
    setSaving(submit ? 'submit' : 'save')
    try {
      const draft: ContentDraft = {
        title: form.title.trim(),
        caption: form.caption,
        hashtags: normalizeHashtags(form.hashtags),
        format: form.format,
        destination: form.destination.trim() || null,
        topic_key: topicKey(form.destination) ?? topicKey(form.title),
        notes: form.notes.trim() || null,
        scheduled_at: fromLocalInput(form.scheduled),
        includes_price: form.includes_price,
        price_source_url: form.includes_price ? form.price_source_url.trim() || null : null,
        price_source_note: form.includes_price ? form.price_source_note.trim() || null : null,
      }
      const existingId = item?.id ?? createdId.current
      const saved = existingId ? await updateContent(existingId, draft) : await createContent(draft)
      createdId.current = saved.id

      for (const a of removed) await removeAsset(a)
      const finalIds: string[] = []
      for (let i = 0; i < media.length; i++) {
        const m = media[i]
        if (m.kind === 'existing') finalIds.push(m.asset.id)
        else finalIds.push((await uploadAsset(saved.id, m.local, i)).id)
      }
      if (media.some((m, i) => m.kind === 'existing' && m.asset.position !== i)) await reorderAssets(finalIds.map((id) => ({ id })))

      const current = await getContent(saved.id)
      if (submit && ['draft', 'error'].includes(current.status)) await transitionContent(saved.id, 'pending_approval')
      if (ideaId && !item) await updateIdea(ideaId, { status: 'used', content_id: saved.id }).catch(() => {})

      toast.success(submit ? 'Guardado y enviado a aprobación.' : 'Contenido guardado.')
      if (!item) nav(`/estudio/${saved.id}`, { replace: true })
      else {
        const fresh = await getContent(saved.id)
        setItem(fresh)
        setForm(fromItem(fresh))
        setMedia(fresh.content_assets.map((a) => ({ kind: 'existing', key: a.id, asset: a })))
        setRemoved([])
      }
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <PageLoader />

  const spec = FORMAT_SPECS[form.format]
  const canSubmit = !item || ['draft', 'error'].includes(item.status)

  return (
    <>
      <PageHeader
        eyebrow="Estudio creativo"
        title={item ? 'Editar contenido' : 'Nuevo contenido'}
        description={item ? undefined : 'Elegí el formato, cargá el material visual y escribí la descripción. Todo se guarda en Supabase y pasa por aprobación antes de publicarse.'}
        actions={
          item && (
            <>
              <StatusBadge status={item.status} className="mr-1" />
              <ButtonLink to="/contenidos" variant="ghost" size="sm" icon={<ArrowLeft className="size-3.5" />}>
                Contenidos
              </ButtonLink>
            </>
          )
        }
      />

      {willNeedReapproval && (
        <div className="mb-6 flex gap-3 rounded-2xl bg-amber-100/70 px-4 py-3.5 text-sm text-amber-600 ring-1 ring-amber-100">
          <AlertTriangle className="size-4 shrink-0" strokeWidth={1.5} />
          Este contenido ya está {item!.status === 'scheduled' ? 'programado' : 'aprobado'}. Si cambiás el texto, el formato o el
          material visual, vuelve a "Pendiente de aprobación".
        </div>
      )}
      {item && !editable && (
        <div className="mb-6 rounded-2xl bg-cream-200 px-4 py-3.5 text-sm text-cocoa-600">
          Este contenido está en estado "{item.status}" y no puede editarse.
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card className="space-y-5 p-5 sm:p-7">
            <SectionTitle n="1" title="Formato" subtitle={spec.description} />
            <FormatPicker value={form.format} onChange={(f) => set('format', f)} disabled={!editable} />
          </Card>

          <Card className="space-y-5 p-5 sm:p-7">
            <SectionTitle n="2" title="Material visual" subtitle={`${spec.label} · ${spec.width} × ${spec.height} px`} />
            <MediaManager
              format={form.format}
              entries={media}
              onChange={setMedia}
              onRemove={(e) => e.kind === 'existing' && setRemoved((r) => [...r, e.asset])}
              disabled={!editable}
            />
          </Card>

          <Card className="space-y-5 p-5 sm:p-7">
            <SectionTitle n="3" title="Texto" />
            <Field label="Título" hint="Uso interno y referencia en el calendario.">
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} disabled={!editable} placeholder="Ej.: Patagonia en otoño" maxLength={200} />
            </Field>
            <Field label="Descripción" aside={`${captionLength}/${INSTAGRAM_CAPTION_MAX}`}>
              <Textarea
                value={form.caption}
                onChange={(e) => set('caption', e.target.value)}
                disabled={!editable}
                rows={7}
                placeholder="El texto que acompaña la publicación…"
              />
            </Field>
            <Field label="Hashtags" hint="Enter o coma para agregar. Máximo 30." aside={`${form.hashtags.length}/30`}>
              <TagInput value={form.hashtags} onChange={(v) => set('hashtags', normalizeHashtags(v))} prefix="#" placeholder="Viajes, Patagonia…" disabled={!editable} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Destino" hint="Ayuda a evitar contenido repetido.">
                <Input value={form.destination} onChange={(e) => set('destination', e.target.value)} disabled={!editable} placeholder="Ej.: Bariloche" />
              </Field>
              <Field label="Fecha programada" hint="Fecha prevista. Se confirma al programar.">
                <Input type="datetime-local" value={form.scheduled} onChange={(e) => set('scheduled', e.target.value)} disabled={!editable} />
              </Field>
            </div>
          </Card>

          <Card className="space-y-5 p-5 sm:p-7">
            <SectionTitle n="4" title="Precios y notas" />
            <Toggle
              checked={form.includes_price}
              onChange={(v) => set('includes_price', v)}
              disabled={!editable}
              label="Incluye precio o tarifa"
              description="Solo con una fuente verificable (proveedor u oferta vigente). Nunca se publican precios estimados."
            />
            {priceDetected && !form.includes_price && (
              <p className="flex gap-2 text-xs text-rose-600">
                <AlertTriangle className="size-4 shrink-0" strokeWidth={1.5} /> El texto parece mencionar un precio. Activá esta opción y cargá la fuente, o quitá el monto.
              </p>
            )}
            {form.includes_price && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Enlace a la fuente" className="sm:col-span-2">
                  <div className="relative">
                    <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cocoa-400" />
                    <Input className="pl-9" type="url" value={form.price_source_url} onChange={(e) => set('price_source_url', e.target.value)} disabled={!editable} placeholder="https://proveedor.com/paquete/…" />
                  </div>
                </Field>
                <Field label="Detalle de la fuente" hint="Proveedor, fecha de consulta, vigencia." className="sm:col-span-2">
                  <Input value={form.price_source_note} onChange={(e) => set('price_source_note', e.target.value)} disabled={!editable} />
                </Field>
              </div>
            )}
            <Field label="Notas internas" hint="No se publican.">
              <Textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} disabled={!editable} />
            </Field>
          </Card>
        </div>

        {/* Columna derecha: vista previa, controles y acciones */}
        <aside className="space-y-5 lg:sticky lg:top-8 lg:self-start">
          <InstagramPreview
            format={form.format}
            media={media.map((m) => (m.kind === 'existing' ? { key: m.key, asset: m.asset } : { key: m.key, src: m.local.previewUrl, mime: m.local.mime }))}
            caption={form.caption}
            hashtags={form.hashtags}
          />

          <Card className="p-5">
            <p className="eyebrow mb-3">Controles de calidad</p>
            <ChecksList checks={checks} />
          </Card>

          {editable && (
            <div className="flex flex-col gap-2">
              {canSubmit && (
                <Button size="lg" onClick={() => save(true)} loading={saving === 'submit'} disabled={!!saving} icon={<Send className="size-4" strokeWidth={1.75} />}>
                  Guardar y enviar a aprobación
                </Button>
              )}
              <Button size="lg" variant="secondary" onClick={() => save(false)} loading={saving === 'save'} disabled={!!saving} icon={<Save className="size-4" strokeWidth={1.75} />}>
                {item ? 'Guardar cambios' : 'Guardar borrador'}
              </Button>
            </div>
          )}

          {item && !canSubmit && (
            <Card className="p-5">
              <p className="eyebrow mb-3">Flujo de aprobación</p>
              <ContentActions item={item} showEdit={false} onChanged={() => getContent(item.id).then((c) => { setItem(c); setForm(fromItem(c)) })} />
            </Card>
          )}

          <Card className="p-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="eyebrow flex items-center gap-1.5">
                <Bot className="size-3.5" /> Generación con IA
              </p>
              {aiText && <IntegrationStatusPill status={aiText.status} />}
            </div>
            <p className="text-xs leading-relaxed text-cocoa-500">
              {aiText?.status === 'connected'
                ? 'La IA de texto está conectada.'
                : 'La generación automática de textos, imágenes y videos todavía no está configurada. Por ahora el contenido se carga manualmente.'}
            </p>
            <ButtonLink to="/configuracion/integraciones-ia" variant="ghost" size="sm" className="mt-2 -ml-3">
              Ver integraciones
            </ButtonLink>
          </Card>
        </aside>
      </div>
    </>
  )
}

function SectionTitle({ n, title, subtitle }: { n: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-display text-lg italic text-gold-500">{n}</span>
      <div>
        <h2 className="text-[1.45rem] leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-cocoa-500">{subtitle}</p>}
      </div>
    </div>
  )
}
