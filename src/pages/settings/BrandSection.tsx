import { Card } from '@/components/ui/Card'
import { Field, Input, TagInput, Textarea } from '@/components/ui/Field'
import { PageLoader } from '@/components/ui/Spinner'
import { ErrorNote } from '@/components/ui/EmptyState'
import { useAuth } from '@/auth/AuthProvider'
import { normalizeHashtags } from '@shared/content'
import { useSettingForm } from './useSettingForm'
import { SaveBar } from './SaveBar'

export function BrandSection() {
  const { isAdmin } = useAuth()
  const f = useSettingForm('brand_identity')
  if (f.error) return <ErrorNote message={f.error} />
  if (!f.value) return <PageLoader />
  const v = f.value
  const ro = !isAdmin

  return (
    <>
      <Card className="space-y-5 p-5 sm:p-7">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nombre de la marca">
            <Input value={v.brand_name} onChange={(e) => f.patch({ brand_name: e.target.value })} disabled={ro} />
          </Field>
          <Field label="Frase de marca">
            <Input value={v.tagline} onChange={(e) => f.patch({ tagline: e.target.value })} disabled={ro} placeholder="Opcional" />
          </Field>
        </div>
        <Field label="Tono de voz" hint="Lo usa el agente para escribir como Avora.">
          <Textarea rows={3} value={v.tone} onChange={(e) => f.patch({ tone: e.target.value })} disabled={ro} />
        </Field>
        <Field label="Reglas de estilo" hint="Una por línea.">
          <Textarea rows={4} value={v.voice_rules.join('\n')} onChange={(e) => f.patch({ voice_rules: e.target.value.split('\n') })} onBlur={() => f.patch({ voice_rules: v.voice_rules.map((r) => r.trim()).filter(Boolean) })} disabled={ro} />
        </Field>
        <Field label="Palabras prohibidas">
          <TagInput value={v.banned_words} onChange={(x) => f.patch({ banned_words: x })} disabled={ro} placeholder="Agregar palabra…" />
        </Field>
        <Field label="Hashtags de marca" hint="Se agregan por defecto a cada contenido nuevo.">
          <TagInput value={v.default_hashtags} onChange={(x) => f.patch({ default_hashtags: normalizeHashtags(x) })} disabled={ro} prefix="#" placeholder="AvoraTravel" />
        </Field>
      </Card>

      <Card className="mt-6 p-5 sm:p-7">
        <p className="eyebrow mb-4">Paleta</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Object.entries(v.palette).map(([name, hex]) => (
            <label key={name} className="space-y-2">
              <span className="block h-20 rounded-2xl ring-1 ring-cream-300" style={{ background: hex }} />
              <span className="flex items-center justify-between text-xs text-cocoa-600">
                <span className="capitalize">{name}</span>
                <input type="color" value={hex} disabled={ro} onChange={(e) => f.patch({ palette: { ...v.palette, [name]: e.target.value } })} className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent disabled:cursor-default" />
              </span>
            </label>
          ))}
        </div>
      </Card>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={f.save} />
    </>
  )
}
