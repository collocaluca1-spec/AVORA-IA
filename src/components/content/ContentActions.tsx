import { useState } from 'react'
import { addDays, setHours, setMinutes } from 'date-fns'
import { CalendarClock, Check, PencilLine, RotateCcw, Send, X, CalendarX2, AlertTriangle, Camera } from 'lucide-react'
import type { ContentStatus } from '@shared/content'
import { ACTION_LABELS, availableTransitions, EDITABLE_STATUSES, type WorkflowAction } from '@shared/workflow'
import { checkContent, hasBlockingErrors, type CheckResult } from '@shared/contentChecks'
import { publishNow, transitionContent, updateContent, type ContentWithAssets } from '@/lib/api/content'
import { friendlyError } from '@/lib/supabase'
import { fromLocalInput, toLocalInput } from '@/lib/dates'
import { useAuth } from '@/auth/AuthProvider'
import { Button, ButtonLink } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Field, Input, Textarea } from '../ui/Field'
import { useToast } from '../ui/Toast'
import { ChecksList } from './ChecksList'

const ICONS: Partial<Record<WorkflowAction, typeof Check>> = {
  submit: Send,
  approve: Check,
  reject: X,
  schedule: CalendarClock,
  cancel_schedule: CalendarX2,
  back_to_draft: RotateCcw,
  reopen: RotateCcw,
  request_reapproval: RotateCcw,
}

const PRIMARY: WorkflowAction[] = ['submit', 'approve', 'schedule']

function defaultScheduleDate(current: string | null): string {
  if (current && new Date(current).getTime() > Date.now() + 5 * 60_000) return toLocalInput(current)
  const d = setMinutes(setHours(addDays(new Date(), 1), 10), 0)
  return toLocalInput(d.toISOString())
}

export function ContentActions({
  item,
  onChanged,
  size = 'sm',
  showEdit = true,
}: {
  item: ContentWithAssets
  onChanged: () => void
  size?: 'sm' | 'md'
  showEdit?: boolean
}) {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [modal, setModal] = useState<null | 'reject' | 'schedule' | 'reschedule' | 'checks'>(null)
  const [reason, setReason] = useState('')
  const [when, setWhen] = useState('')
  const [checks, setChecks] = useState<CheckResult[]>([])

  const transitions = availableTransitions(item.status, isAdmin ? 'admin' : 'editor')

  async function go(to: ContentStatus, action: WorkflowAction, extra?: Parameters<typeof transitionContent>[2]) {
    setBusy(action)
    try {
      await transitionContent(item.id, to, extra)
      toast.success(`${ACTION_LABELS[action]}: listo.`)
      setModal(null)
      onChanged()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  function start(action: WorkflowAction, to: ContentStatus) {
    if (action === 'submit') {
      const r = checkContent(
        {
          title: item.title,
          caption: item.caption,
          hashtags: item.hashtags,
          format: item.format,
          includes_price: item.includes_price,
          price_source_url: item.price_source_url,
          scheduled_at: item.scheduled_at,
          assets: item.content_assets,
        },
        { forSubmission: true },
      )
      if (hasBlockingErrors(r)) {
        setChecks(r)
        setModal('checks')
        return
      }
      return go(to, action)
    }
    if (action === 'reject') {
      setReason('')
      setModal('reject')
      return
    }
    if (action === 'schedule') {
      setWhen(defaultScheduleDate(item.scheduled_at))
      setModal('schedule')
      return
    }
    return go(to, action)
  }

  async function reschedule() {
    const iso = fromLocalInput(when)
    if (!iso) return
    setBusy('reschedule')
    try {
      await updateContent(item.id, { scheduled_at: iso })
      toast.success('Publicación reprogramada.')
      setModal(null)
      onChanged()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  async function publishNowClick() {
    setBusy('publish_now')
    try {
      toast.success(await publishNow(item.id))
      setTimeout(onChanged, 15000)
      onChanged()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  const ordered = [...transitions].sort(
    (a, b) => Number(PRIMARY.includes(b.action)) - Number(PRIMARY.includes(a.action)),
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ordered.map((t) => {
        const Icon = ICONS[t.action] ?? RotateCcw
        const variant =
          t.action === 'approve' ? 'gold' : PRIMARY.includes(t.action) ? 'primary' : t.action === 'reject' ? 'danger' : 'secondary'
        return (
          <Button
            key={t.action + t.to}
            size={size}
            variant={variant}
            loading={busy === t.action}
            icon={<Icon className="size-3.5" strokeWidth={1.75} />}
            onClick={() => start(t.action, t.to)}
          >
            {ACTION_LABELS[t.action]}
          </Button>
        )
      })}
      {isAdmin && (item.status === 'approved' || item.status === 'scheduled') && (
        <Button
          size={size}
          variant="gold"
          loading={busy === 'publish_now'}
          icon={<Camera className="size-3.5" strokeWidth={1.75} />}
          onClick={publishNowClick}
        >
          Publicar ahora
        </Button>
      )}
      {item.status === 'scheduled' && (
        <Button
          size={size}
          variant="secondary"
          icon={<CalendarClock className="size-3.5" strokeWidth={1.75} />}
          onClick={() => {
            setWhen(defaultScheduleDate(item.scheduled_at))
            setModal('reschedule')
          }}
        >
          Reprogramar
        </Button>
      )}
      {item.status === 'pending_approval' && !isAdmin && (
        <span className="text-xs text-cocoa-500">Esperando aprobación de un administrador</span>
      )}
      {showEdit && EDITABLE_STATUSES.includes(item.status) && (
        <ButtonLink
          to={`/estudio/${item.id}`}
          size={size}
          variant="ghost"
          icon={<PencilLine className="size-3.5" strokeWidth={1.75} />}
        >
          Editar
        </ButtonLink>
      )}

      <Modal
        open={modal === 'reject'}
        onClose={() => setModal(null)}
        eyebrow="Rechazar"
        title={item.title}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>
              Volver
            </Button>
            <Button
              variant="danger"
              disabled={!reason.trim()}
              loading={busy === 'reject'}
              onClick={() => go('rejected', 'reject', { rejection_reason: reason.trim() })}
            >
              Rechazar contenido
            </Button>
          </>
        }
      >
        <Field label="Motivo del rechazo" hint="Se guarda en el historial para que el equipo pueda corregirlo.">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="Ej.: la foto no corresponde al destino." />
        </Field>
      </Modal>

      <Modal
        open={modal === 'schedule' || modal === 'reschedule'}
        onClose={() => setModal(null)}
        eyebrow={modal === 'schedule' ? 'Programar publicación' : 'Reprogramar'}
        title={item.title}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>
              Volver
            </Button>
            <Button
              disabled={!when}
              loading={busy === 'schedule' || busy === 'reschedule'}
              onClick={() =>
                modal === 'schedule'
                  ? go('scheduled', 'schedule', { scheduled_at: fromLocalInput(when) })
                  : reschedule()
              }
            >
              Confirmar fecha
            </Button>
          </>
        }
      >
        <Field label="Fecha y hora" hint="Hora local de tu dispositivo.">
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
        <p className="mt-4 flex gap-2 rounded-xl bg-amber-100/60 px-3.5 py-3 text-xs text-amber-600">
          <AlertTriangle className="size-4 shrink-0" strokeWidth={1.5} />
          La publicación automática está desactivada hasta configurar Instagram. Programar reserva la fecha en el
          calendario; no publica nada todavía.
        </p>
      </Modal>

      <Modal
        open={modal === 'checks'}
        onClose={() => setModal(null)}
        eyebrow="Antes de enviar a aprobación"
        title="Hay puntos para resolver"
        size="sm"
        footer={
          <ButtonLink to={`/estudio/${item.id}`} size="md">
            Abrir en el Estudio
          </ButtonLink>
        }
      >
        <ChecksList checks={checks} />
      </Modal>
    </div>
  )
}
