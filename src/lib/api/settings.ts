import { db } from '../supabase'
import type { IntegrationKey, IntegrationStatus } from '@shared/integrations'

export type SettingsKey = 'brand_identity' | 'publishing_frequency' | 'content_preferences' | 'automations'

export interface BrandIdentity {
  brand_name: string
  tagline: string
  tone: string
  voice_rules: string[]
  banned_words: string[]
  default_hashtags: string[]
  palette: Record<string, string>
}
export interface PublishingFrequency {
  timezone: string
  per_week: Record<string, number>
  preferred_times: string[]
}
export interface ContentPreferences {
  focus_destinations: string[]
  excluded_destinations: string[]
  content_pillars: string[]
  audience: string
  avoid_repeat_days: number
}
export interface Automations {
  auto_publish_enabled: boolean
  agent_auto_proposals: boolean
  agent_proposals_per_week: number
}
export interface SettingsMap {
  brand_identity: BrandIdentity
  publishing_frequency: PublishingFrequency
  content_preferences: ContentPreferences
  automations: Automations
}

export async function getSetting<K extends SettingsKey>(key: K): Promise<SettingsMap[K]> {
  const { data, error } = await db().from('app_settings').select('value').eq('key', key).single()
  if (error) throw error
  return data.value as SettingsMap[K]
}

export async function saveSetting<K extends SettingsKey>(key: K, value: SettingsMap[K]): Promise<void> {
  const { data, error } = await db().from('app_settings').update({ value }).eq('key', key).select('key')
  if (error) throw error
  if (!data?.length) throw new Error('No tenés permisos para modificar la configuración (solo administradores).')
}

export interface IntegrationRow {
  key: IntegrationKey
  status: IntegrationStatus
  provider: string | null
  last_checked_at: string | null
  last_error: string | null
  details: Record<string, unknown>
  updated_at: string
}

export async function listIntegrations(): Promise<IntegrationRow[]> {
  const { data, error } = await db().from('integrations').select('*')
  if (error) throw error
  return data as IntegrationRow[]
}

/**
 * Pide al servidor que revise las credenciales configuradas en Netlify.
 * Si las funciones de servidor no están desplegadas, lo indica claramente.
 */
export async function requestIntegrationCheck(): Promise<{ ok: boolean; message: string }> {
  const { data: s } = await db().auth.getSession()
  const token = s.session?.access_token
  let res: Response
  try {
    res = await fetch('/api/integrations-check', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    return { ok: false, message: 'No se pudo contactar a las funciones de servidor.' }
  }
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('application/json'))
    return {
      ok: false,
      message: 'Las funciones de servidor no están disponibles en este entorno (usá Netlify o `netlify dev`).',
    }
  const body = (await res.json()) as { message?: string; error?: string }
  return { ok: res.ok, message: body.message ?? body.error ?? (res.ok ? 'Verificación realizada.' : 'Error') }
}
