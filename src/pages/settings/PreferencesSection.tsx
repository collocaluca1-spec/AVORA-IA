import { Card } from '@/components/ui/Card'
import { Field, Input, TagInput, Textarea } from '@/components/ui/Field'
import { PageLoader } from '@/components/ui/Spinner'
import { ErrorNote } from '@/components/ui/EmptyState'
import { useAuth } from '@/auth/AuthProvider'
import { useSettingForm } from './useSettingForm'
import { SaveBar } from './SaveBar'

export function PreferencesSection() {
  const { isAdmin } = useAuth()
  const f = useSettingForm('content_preferences')
  if (f.error) return <ErrorNote message={f.error} />
  if (!f.value) return <PageLoader />
  const v = f.value
  const ro = !isAdmin
  return (
    <>
      <Card className="space-y-5 p-5 sm:p-7">
        <Field label="Pilares de contenido">
          <TagInput value={v.content_pillars} onChange={(x) => f.patch({ content_pillars: x })} disabled={ro} placeholder="Agregar pilar…" />
        </Field>
        <Field label="Destinos prioritarios">
          <TagInput value={v.focus_destinations} onChange={(x) => f.patch({ focus_destinations: x })} disabled={ro} placeholder="Ej.: Patagonia" />
        </Field>
        <Field label="Destinos excluidos" hint="El agente nunca los propondrá.">
          <TagInput value={v.excluded_destinations} onChange={(x) => f.patch({ excluded_destinations: x })} disabled={ro} />
        </Field>
        <Field label="Audiencia">
          <Textarea rows={3} value={v.audience} onChange={(e) => f.patch({ audience: e.target.value })} disabled={ro} placeholder="Ej.: parejas de 30 a 55 años que buscan viajes de calidad…" />
        </Field>
        <Field label="Evitar repetir un tema durante (días)" className="sm:max-w-xs">
          <Input type="number" min={0} max={365} value={v.avoid_repeat_days} onChange={(e) => f.patch({ avoid_repeat_days: Number(e.target.value) })} disabled={ro} />
        </Field>
      </Card>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={f.save} />
    </>
  )
}
