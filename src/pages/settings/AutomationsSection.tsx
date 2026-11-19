import { Lock } from 'lucide-react'
import { listIntegrations } from '@/lib/api/settings'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/auth/AuthProvider'
import { Card } from '@/components/ui/Card'
import { Toggle } from '@/components/ui/Field'
import { PageLoader } from '@/components/ui/Spinner'
import { ErrorNote } from '@/components/ui/EmptyState'
import { IntegrationStatusPill } from '@/components/content/IntegrationStatusPill'
import { useSettingForm } from './useSettingForm'
import { SaveBar } from './SaveBar'

export function AutomationsSection() {
  const { isAdmin } = useAuth()
  const f = useSettingForm('automations')
  const integrations = useAsync(listIntegrations, [])
  if (f.error) return <ErrorNote message={f.error} />
  if (!f.value || !integrations.data) return <PageLoader />
  const v = f.value
  const ig = integrations.data.find((i) => i.key === 'instagram')!
  const ai = integrations.data.find((i) => i.key === 'ai_text')!
  const n8n = integrations.data.find((i) => i.key === 'n8n')!
  const igReady = ig.status === 'connected'
  const aiReady = ai.status === 'connected'

  return (
    <>
      <Card className="divide-y divide-cream-200">
        <div className="space-y-3 p-5 sm:p-7">
          <Toggle
            checked={v.auto_publish_enabled}
            disabled={!isAdmin || !igReady}
            onChange={(x) => f.patch({ auto_publish_enabled: x })}
            label="Publicación automática en Instagram"
            description="Publica en la fecha programada el contenido aprobado. Nunca publica nada sin aprobación."
          />
          {!igReady && (
            <p className="flex items-center gap-2 text-xs text-cocoa-500">
              <Lock className="size-3.5 text-gold-500" /> Bloqueada hasta conectar Instagram. <IntegrationStatusPill status={ig.status} />
            </p>
          )}
        </div>
        <div className="space-y-3 p-5 sm:p-7">
          <Toggle
            checked={v.agent_auto_proposals}
            disabled={!isAdmin || !aiReady}
            onChange={(x) => f.patch({ agent_auto_proposals: x })}
            label="Armar la semana automáticamente"
            description="Cada jueves a las 9:00 el agente prepara la semana siguiente según la frecuencia de publicación: investiga, escribe, busca fotos y videos reales y lo deja todo en el calendario como pendiente de tu aprobación."
          />
          {!aiReady && (
            <p className="flex items-center gap-2 text-xs text-cocoa-500">
              <Lock className="size-3.5 text-gold-500" /> Requiere IA de texto conectada. <IntegrationStatusPill status={ai.status} />
            </p>
          )}
          <p className="text-xs text-cocoa-500">La cantidad de piezas por formato se define en Configuración → Frecuencia.</p>
        </div>
        <div className="flex items-center justify-between gap-3 p-5 sm:p-7">
          <div>
            <p className="text-[0.92rem] text-cocoa-800">Flujos de n8n</p>
            <p className="text-xs text-cocoa-500">Orquestación de tareas programadas (Fase 3).</p>
          </div>
          <IntegrationStatusPill status={n8n.status} />
        </div>
      </Card>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={f.save} />
    </>
  )
}
