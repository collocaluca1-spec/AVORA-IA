import { db } from '../supabase'
import type { ContentFormat } from '@shared/content'

export interface ContentIdea {
  id: string
  title: string
  destination: string | null
  angle: string | null
  suggested_format: ContentFormat | null
  season: string | null
  rationale: string | null
  topic_key: string | null
  sources: { url: string; title?: string }[]
  status: 'proposed' | 'accepted' | 'discarded' | 'used'
  origin: 'manual' | 'agent'
  content_id: string | null
  created_at: string
}

export async function listIdeas(): Promise<ContentIdea[]> {
  const { data, error } = await db().from('content_ideas').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as ContentIdea[]
}

export async function createIdea(i: Partial<ContentIdea>): Promise<void> {
  const { error } = await db().from('content_ideas').insert(i)
  if (error) throw error
}

export async function updateIdea(id: string, patch: Partial<ContentIdea>): Promise<void> {
  const { error } = await db().from('content_ideas').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteIdea(id: string): Promise<void> {
  const { error } = await db().from('content_ideas').delete().eq('id', id)
  if (error) throw error
}

export interface RecentTopic {
  topic_key: string
  destination: string | null
  last_used: string
  uses: number
}

export async function recentTopics(days: number): Promise<RecentTopic[]> {
  const { data, error } = await db().rpc('recent_topics', { p_days: days })
  if (error) throw error
  return data as RecentTopic[]
}

export interface AgentRun {
  id: string
  task: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'not_configured'
  input: Record<string, unknown>
  output: unknown
  error: string | null
  created_at: string
}

export async function listAgentRuns(): Promise<AgentRun[]> {
  const { data, error } = await db().from('agent_runs').select('*').order('created_at', { ascending: false }).limit(20)
  if (error) throw error
  return data as AgentRun[]
}
