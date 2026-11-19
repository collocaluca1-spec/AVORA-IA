import { CONTENT_FORMATS, FORMAT_SPECS } from '@shared/content'
import { Card } from '@/components/ui/Card'
import { Field, Input, TagInput } from '@/components/ui/Field'
import { PageLoader } from '@/components/ui/Spinner'
import { ErrorNote } from '@/components/ui/EmptyState'
import { FormatIcon } from '@/components/content/FormatIcon'
import { useAuth } from '@/auth/AuthProvider'
import { useSettingForm } from './useSettingForm'
import { SaveBar } from './SaveBar'

export function FrequencySection() {
  const { isAdmin } = useAuth()
  const f = useSettingForm('publishing_frequency')
  if (f.error) return <ErrorNote message={f.error} />
  if (!f.value) return <PageLoader />
  const v = f.value
  const total = Object.values(v.per_week).reduce((a, b) => a + Number(b || 0), 0)

  return (
    <>
      <Card className="p-5 sm:p-7">
        <div className="mb-5 flex items-baseline justify-between">
          <p className="eyebrow">Publicaciones por semana</p>
          <p className="text-sm text-cocoa-500">
            Total: <span className="font-display text-xl text-cocoa-900">{total}</span>
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {CONTENT_FORMATS.map((fmt) => (
            <div key={fmt} className="flex items-center justify-between gap-3 rounded-xl bg-cream-100/60 px-4 py-3 ring-1 ring-cream-200">
              <span className="flex items-center gap-2 text-sm text-cocoa-700">
                <FormatIcon format={fmt} className="size-4 text-gold-500" />
                {FORMAT_SPECS[fmt].label}
              </span>
              <Input
                type="number"
                min={0}
                max={50}
                className="w-20 text-center"
                value={v.per_week[fmt] ?? 0}
                disabled={!isAdmin}
                onChange={(e) => f.patch({ per_week: { ...v.per_week, [fmt]: Math.max(0, Number(e.target.value)) } })}
              />
            </div>
          ))}
        </div>
      </Card>
      <Card className="mt-6 grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
        <Field label="Horarios preferidos" hint="Formato 24 h, p. ej. 19:30.">
          <TagInput value={v.preferred_times} onChange={(x) => f.patch({ preferred_times: x.filter((t) => /^\d{1,2}:\d{2}$/.test(t)) })} disabled={!isAdmin} placeholder="09:30" />
        </Field>
        <Field label="Zona horaria">
          <Input value={v.timezone} disabled />
        </Field>
      </Card>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={f.save} />
    </>
  )
}
