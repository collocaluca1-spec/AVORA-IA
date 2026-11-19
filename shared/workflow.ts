import type { ContentStatus } from './content.ts'

/**
 * Máquina de estados del flujo de aprobación.
 * Esta tabla es la referencia para la UI. La base de datos aplica las mismas
 * reglas en el trigger `content_items_enforce_workflow` (fuente de verdad).
 *
 * actor:
 *  - 'team'   → un usuario del panel (editor o admin)
 *  - 'admin'  → solo administradores
 *  - 'server' → solo funciones de servidor (service role): generación IA y publicación
 */
export type Actor = 'team' | 'admin' | 'server'

export interface Transition {
  from: ContentStatus
  to: ContentStatus
  actor: Actor
  action: WorkflowAction
}

export type WorkflowAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'schedule'
  | 'cancel_schedule'
  | 'back_to_draft'
  | 'reopen'
  | 'request_reapproval'
  | 'start_generation'
  | 'finish_generation'
  | 'start_publishing'
  | 'mark_published'
  | 'mark_error'

export const TRANSITIONS: Transition[] = [
  { from: 'draft', to: 'pending_approval', actor: 'team', action: 'submit' },
  { from: 'draft', to: 'generating', actor: 'server', action: 'start_generation' },
  { from: 'generating', to: 'pending_approval', actor: 'server', action: 'finish_generation' },
  { from: 'generating', to: 'draft', actor: 'server', action: 'back_to_draft' },
  { from: 'generating', to: 'error', actor: 'server', action: 'mark_error' },
  { from: 'pending_approval', to: 'approved', actor: 'admin', action: 'approve' },
  { from: 'pending_approval', to: 'rejected', actor: 'admin', action: 'reject' },
  { from: 'pending_approval', to: 'draft', actor: 'team', action: 'back_to_draft' },
  { from: 'approved', to: 'scheduled', actor: 'team', action: 'schedule' },
  { from: 'approved', to: 'draft', actor: 'team', action: 'back_to_draft' },
  { from: 'approved', to: 'pending_approval', actor: 'team', action: 'request_reapproval' },
  { from: 'scheduled', to: 'pending_approval', actor: 'team', action: 'request_reapproval' },
  { from: 'scheduled', to: 'approved', actor: 'team', action: 'cancel_schedule' },
  { from: 'scheduled', to: 'publishing', actor: 'server', action: 'start_publishing' },
  { from: 'publishing', to: 'published', actor: 'server', action: 'mark_published' },
  { from: 'publishing', to: 'error', actor: 'server', action: 'mark_error' },
  { from: 'error', to: 'draft', actor: 'team', action: 'back_to_draft' },
  { from: 'error', to: 'pending_approval', actor: 'team', action: 'submit' },
  { from: 'rejected', to: 'draft', actor: 'team', action: 'reopen' },
]

/** Estados en los que el contenido todavía puede editarse desde el panel. */
export const EDITABLE_STATUSES: ContentStatus[] = [
  'draft',
  'pending_approval',
  'approved',
  'scheduled',
  'error',
  'rejected',
]

/**
 * Editar el contenido de algo ya aprobado o programado lo devuelve a
 * "pendiente de aprobación": nada se publica sin que la versión final haya sido aprobada.
 */
export const REQUIRES_REAPPROVAL_ON_EDIT: ContentStatus[] = ['approved', 'scheduled']

export type Role = 'admin' | 'editor'

export function canTransition(from: ContentStatus, to: ContentStatus, role: Role): boolean {
  return TRANSITIONS.some(
    (t) =>
      t.from === from &&
      t.to === to &&
      (t.actor === 'team' || (t.actor === 'admin' && role === 'admin')),
  )
}

export function availableTransitions(from: ContentStatus, role: Role): Transition[] {
  return TRANSITIONS.filter(
    (t) => t.from === from && (t.actor === 'team' || (t.actor === 'admin' && role === 'admin')),
  )
}

export const ACTION_LABELS: Record<WorkflowAction, string> = {
  submit: 'Enviar a aprobación',
  approve: 'Aprobar',
  reject: 'Rechazar',
  schedule: 'Programar',
  cancel_schedule: 'Cancelar programación',
  back_to_draft: 'Volver a borrador',
  reopen: 'Reabrir como borrador',
  request_reapproval: 'Pedir nueva aprobación',
  start_generation: 'Generar',
  finish_generation: 'Finalizar generación',
  start_publishing: 'Publicar',
  mark_published: 'Marcar publicado',
  mark_error: 'Marcar error',
}
