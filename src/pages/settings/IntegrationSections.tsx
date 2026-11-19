import { useState, type ReactNode } from 'react'
import { RefreshCw, ShieldCheck, KeyRound, Info } from 'lucide-react'
import { INTEGRATIONS, type IntegrationKey } from '@shared/integrations'
import { listIntegrations, requestIntegrationCheck, type IntegrationRow } from '@/lib/api/settings'
import { useAsync } from '@/hooks/useAsync'
import { relative } from '@/lib/dates'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { ErrorNote } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { IntegrationStatusPill } from '@/components/content/IntegrationStatusPill'

function useIntegrations() {
  const toast = useToast()
  const list = useAsync(listIntegrations, [])
  const [checking, setChecking] = useState(false)
  async function check() {
    setChecking(true)
    const r = await requestIntegrationCheck()
    setChecking(false)
    r.ok ? toast.success(r.message) : toast.error(r.message)
    list.reload()
  }
  return { list, check, checking }
}

function IntegrationCard({ row, children }: { row: IntegrationRow | undefined; k: IntegrationKey; children?: ReactNode }) {
  if (!row) return null
  const def = INTEGRATIONS[row.key]
  const envDetails = (row.details?.env_vars as { name: string; present: boolean }[] | undefined) ?? null
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-2xl">{def.name}</h3>
            <span className="rounded-full bg-cream-200 px-2 py-0.5 text-[0.65rem] uppercase tracking-wider text-cocoa-500">{def.phase}</span>
          </div>
          <p className="mt-1 text-sm text-cocoa-500">{def.description}</p>
        </div>
        <IntegrationStatusPill status={row.status} />
      </div>
      {def.envVars.length > 0 && (
        <div className="mt-5 rounded-xl bg-cream-100/70 p-4 ring-1 ring-cream-200">
          <p className="mb-2 flex items-center gap-1.5 text-xs text-cocoa-600">
            <KeyRound className="size-3.5 text-gold-500" /> Variables del servidor (Netlify → Environment variables)
          </p>
          <ul className="space-y-1">
            {def.envVars.map((v) => {
              const present = envDetails?.find((e) => e.name === v)?.present
              return (
                <li key={v} className="flex items-center justify-between gap-2 font-mono text-[0.72rem] text-cocoa-700">
                  {v}
                  <span className={present ? 'text-sage-600' : 'text-cocoa-400'}>{envDetails ? (present ? 'cargada' : 'falta') : 'sin verificar'}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {row.last_error && <p className="mt-3 text-xs text-rose-600">{row.last_error}</p>}
      <p className="mt-3 text-xs text-cocoa-400">{row.last_checked_at ? `Última verificación ${relative(row.last_checked_at)}` : 'Nunca verificada'}</p>
      {children}
    </Card>
  )
}

function Intro({ onCheck, checking }: { onCheck: () => void; checking: boolean }) {
  return (
    <Card className="mb-6 flex flex-col gap-4 bg-cocoa-800 p-5 text-cream-100 ring-cocoa-700 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-champagne-300" strokeWidth={1.5} />
        <p className="text-sm leading-relaxed text-cream-200/85">
          Las claves API se cargan solo en el servidor (Netlify), nunca en este panel. El estado lo determina el servidor; nada se
          marca como conectado sin una verificación real.
        </p>
      </div>
      <Button variant="gold" size="sm" onClick={onCheck} loading={checking} icon={<RefreshCw className="size-3.5" />}>
        Verificar en el servidor
      </Button>
    </Card>
  )
}

export function AiIntegrationsSection() {
  const { list, check, checking } = useIntegrations()
  if (list.error) return <ErrorNote message={list.error} onRetry={list.reload} />
  if (!list.data) return <PageLoader />
  const get = (k: IntegrationKey) => list.data!.find((r) => r.key === k)
  return (
    <>
      <Intro onCheck={check} checking={checking} />
      <div className="space-y-4">
        {(['ai_text', 'stock_media', 'ai_image', 'ai_video', 'n8n'] as IntegrationKey[]).map((k) => (
          <IntegrationCard key={k} k={k} row={get(k)} />
        ))}
      </div>
    </>
  )
}

export function InstagramSection() {
  const { list, check, checking } = useIntegrations()
  if (list.error) return <ErrorNote message={list.error} onRetry={list.reload} />
  if (!list.data) return <PageLoader />
  const row = list.data.find((r) => r.key === 'instagram')
  return (
    <>
      <Intro onCheck={check} checking={checking} />
      <IntegrationCard k="instagram" row={row}>
        <div className="mt-5 space-y-2 border-t border-cream-200 pt-5 text-sm text-cocoa-600">
          <p className="flex gap-2">
            <Info className="mt-0.5 size-4 shrink-0 text-gold-500" strokeWidth={1.5} />
            Requisitos: cuenta profesional de Instagram vinculada a una página de Facebook, app de Meta con permisos de publicación y
            token de larga duración.
          </p>
          <p className="flex gap-2">
            <Info className="mt-0.5 size-4 shrink-0 text-gold-500" strokeWidth={1.5} />
            La publicación automática permanece desactivada (bloqueada en la base de datos) hasta que Instagram figure como
            "Conectado".
          </p>
        </div>
      </IntegrationCard>
    </>
  )
}

export function ProvidersSection() {
  const { list } = useIntegrations()
  if (!list.data) return <PageLoader />
  const row = list.data.find((r) => r.key === 'travel_providers')
  return (
    <>
      <IntegrationCard k="travel_providers" row={row} />
      <Card className="mt-6 p-5 sm:p-7">
        <p className="eyebrow mb-3">Política de precios</p>
        <ul className="space-y-2 text-sm leading-relaxed text-cocoa-600">
          <li>· El sistema nunca genera precios turísticos.</li>
          <li>· Un contenido con precio exige un enlace verificable a la fuente (validado en el panel y en la base de datos).</li>
          <li>· El agente descarta cualquier propuesta que mencione montos.</li>
          <li>· Cuando se conecten proveedores (Fase 4), los precios se tomarán de sus fuentes con fecha de consulta.</li>
        </ul>
      </Card>
    </>
  )
}
