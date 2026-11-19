import { db } from '../supabase'

export type Role = 'admin' | 'editor'
export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  role: Role | null
  created_at: string
}

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await db().from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await db().from('profiles').select('*').order('created_at')
  if (error) throw error
  return data as Profile[]
}

export async function setRole(id: string, role: Role | null): Promise<void> {
  const { error } = await db().from('profiles').update({ role }).eq('id', id)
  if (error) throw error
}

export async function updateMyName(id: string, full_name: string): Promise<void> {
  const { error } = await db().from('profiles').update({ full_name }).eq('id', id)
  if (error) throw error
}
