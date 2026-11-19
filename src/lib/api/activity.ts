import { db } from '../supabase'

export interface ActivityEntry {
  id: number
  created_at: string
  actor_id: string | null
  level: 'info' | 'warning' | 'error'
  action: string
  entity_type: string | null
  entity_id: string | null
  message: string | null
  details: Record<string, unknown>
}

export async function listActivity(opts: { level?: 'error' | 'warning'; limit?: number } = {}): Promise<ActivityEntry[]> {
  let q = db().from('activity_log').select('*').order('created_at', { ascending: false }).limit(opts.limit ?? 100)
  if (opts.level) q = q.eq('level', opts.level)
  const { data, error } = await q
  if (error) throw error
  return data as ActivityEntry[]
}

/** Registra un error de la interfaz en la base (sin datos sensibles). */
export async function logClientError(action: string, message: string, details: Record<string, unknown> = {}) {
  try {
    const { data } = await db().auth.getUser()
    if (!data.user) return
    await db().from('activity_log').insert({
      actor_id: data.user.id,
      level: 'error',
      action,
      message: message.slice(0, 500),
      details: { ...details, path: location.pathname },
    })
  } catch {
    /* el registro de errores nunca debe romper la interfaz */
  }
}
