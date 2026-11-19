import { HttpError } from './http.ts'
import { supabaseAdmin } from './supabaseAdmin.ts'

export interface TeamUser {
  id: string
  email: string | undefined
  role: 'admin' | 'editor'
}

/** Verifica el JWT de Supabase del usuario y que tenga rol en el equipo. */
export async function requireTeamMember(req: Request, opts: { admin?: boolean } = {}): Promise<TeamUser> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'unauthorized', 'Falta la sesión.')
  const admin = supabaseAdmin()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'unauthorized', 'Sesión inválida o vencida.')
  const { data: profile } = await admin.from('profiles').select('role').eq('id', data.user.id).single()
  if (!profile?.role) throw new HttpError(403, 'forbidden', 'La cuenta no tiene acceso al panel.')
  if (opts.admin && profile.role !== 'admin') throw new HttpError(403, 'forbidden', 'Solo administradores.')
  return { id: data.user.id, email: data.user.email, role: profile.role }
}
