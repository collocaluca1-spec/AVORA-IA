import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env, isSupabaseConfigured } from './env'

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(env.supabaseUrl!, env.supabaseAnonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

/** Devuelve el cliente o lanza un error claro si Supabase no está configurado. */
export function db(): SupabaseClient {
  if (!supabase) throw new Error('Supabase no está configurado (faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
  return supabase
}

export const MEDIA_BUCKET = 'content-media'

/** Traduce errores de Postgres/Supabase a mensajes comprensibles. */
export function friendlyError(err: unknown): string {
  const e = err as { message?: string; code?: string; details?: string }
  const msg = e?.message ?? String(err)
  if (msg.includes('price_requires_verifiable_source'))
    return 'Los contenidos con precio necesitan un enlace verificable a la fuente.'
  if (msg.includes('rejected_requires_reason')) return 'Indicá el motivo del rechazo.'
  if (msg.includes('row-level security')) return 'No tenés permisos para esta acción.'
  if (msg.includes('Failed to fetch')) return 'No hay conexión con el servidor.'
  return msg
}
