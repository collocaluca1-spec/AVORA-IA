import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { HttpError } from './http.ts'

/**
 * Cliente con service role. SOLO se usa en funciones de servidor.
 * La clave vive en las variables de entorno de Netlify, nunca en el bundle del navegador.
 */
let client: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key)
    throw new HttpError(503, 'server_not_configured', 'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el servidor.')
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return client
}

export async function logServer(
  action: string,
  message: string,
  opts: { level?: 'info' | 'warning' | 'error'; actorId?: string; entityType?: string; entityId?: string; details?: Record<string, unknown> } = {},
) {
  await supabaseAdmin()
    .from('activity_log')
    .insert({
      action,
      message,
      level: opts.level ?? 'info',
      actor_id: opts.actorId ?? null,
      entity_type: opts.entityType ?? null,
      entity_id: opts.entityId ?? null,
      details: opts.details ?? {},
    })
}
