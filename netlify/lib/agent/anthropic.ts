import Anthropic from '@anthropic-ai/sdk'
import type { GenerateJSONArgs, TextProvider } from './providers.ts'

const MODEL = 'claude-opus-5-5'

export interface WebSource {
  url: string
  title: string
}

/** Extrae el primer objeto JSON de un texto (tolera ```json …``` alrededor). */
export function extractJSON(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = (fenced ? fenced[1] : text).trim()
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('La IA no devolvió JSON.')
  return JSON.parse(body.slice(start, end + 1))
}

const normUrl = (u: string) => u.trim().replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase()

/**
 * Deja solo las fuentes que la búsqueda web realmente consultó: así una URL
 * inventada por el modelo nunca llega al panel como "fuente".
 */
export function keepRetrievedSources(value: unknown, retrieved: Map<string, WebSource>): WebSource[] {
  if (!Array.isArray(value)) return []
  const out: WebSource[] = []
  const seen = new Set<string>()
  for (const s of value) {
    const url = typeof s?.url === 'string' ? s.url : ''
    const hit = retrieved.get(normUrl(url))
    if (hit && !seen.has(normUrl(hit.url))) {
      seen.add(normUrl(hit.url))
      out.push({ url: hit.url, title: typeof s.title === 'string' && s.title ? s.title : hit.title })
    }
  }
  return out
}

/** Recorre el JSON y reemplaza cada arreglo "sources" por su versión verificada. */
function verifySourcesDeep(node: unknown, retrieved: Map<string, WebSource>): unknown {
  if (Array.isArray(node)) return node.map((n) => verifySourcesDeep(n, retrieved))
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node)) {
      out[k] = k === 'sources' ? keepRetrievedSources(v, retrieved) : verifySourcesDeep(v, retrieved)
    }
    return out
  }
  return node
}

/**
 * Las claves de la consola pueden ser de API clásicas (sk-ant-api…) o claves
 * vinculadas a un usuario o cuenta de servicio (sk-ant-usr…). La API acepta la
 * clave en `x-api-key` o como `Authorization: Bearer`; probamos la primera y, si
 * la API responde 401, reintentamos con la segunda y recordamos cuál funcionó.
 */
let preferBearer: boolean | null = null

export function createAnthropicProvider(apiKey: string): TextProvider {
  const viaHeader = new Anthropic({ apiKey })
  const viaBearer = new Anthropic({ apiKey: null, authToken: apiKey })

  async function withAuth<T>(fn: (c: Anthropic) => Promise<T>): Promise<T> {
    const first = preferBearer ?? apiKey.startsWith('sk-ant-usr')
    try {
      const r = await fn(first ? viaBearer : viaHeader)
      preferBearer = first
      return r
    } catch (e) {
      if (!(e instanceof Anthropic.AuthenticationError)) throw e
      const r = await fn(first ? viaHeader : viaBearer)
      preferBearer = !first
      return r
    }
  }

  return {
    name: 'anthropic',
    supportsWebSources: true,

    async generateJSON({ system, prompt, maxTokens, needsWebSources, webSearchMaxUses }: GenerateJSONArgs) {
      const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: 'user', content: prompt }]
      const retrieved = new Map<string, WebSource>()
      let text = ''

      // Un turno con búsqueda web puede pausarse (pause_turn): se reenvía para que siga.
      for (let turn = 0; turn < 6; turn++) {
        const message = await withAuth((client) => client.beta.messages.stream({
          model: MODEL,
          max_tokens: maxTokens ?? 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          thinking: { type: 'adaptive' },
          output_config: { effort: 'medium' },
          system,
          messages,
          ...(needsWebSources
            ? { tools: [{ type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: webSearchMaxUses ?? 6 }] }
            : {}),
        }).finalMessage())

        for (const block of message.content) {
          if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
            for (const r of block.content) {
              if (r.type === 'web_search_result') retrieved.set(normUrl(r.url), { url: r.url, title: r.title })
            }
          }
        }
        text = message.content
          .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('')

        if (message.stop_reason === 'refusal') throw new Error('La IA rechazó el pedido.')
        if (message.stop_reason === 'pause_turn') {
          messages.push({ role: 'assistant', content: message.content })
          continue
        }
        if (message.stop_reason === 'max_tokens') throw new Error('La respuesta de la IA quedó incompleta (límite de longitud).')
        break
      }

      const parsed = extractJSON(text)
      return needsWebSources ? verifySourcesDeep(parsed, retrieved) : parsed
    },

    async verify() {
      // Llamada mínima para confirmar que la clave es válida.
      const res = await withAuth((client) => client.messages.create({
        model: MODEL,
        max_tokens: 64,
        output_config: { effort: 'low' },
        messages: [{ role: 'user', content: 'Respondé solo: ok' }],
      }))
      return res.stop_reason !== 'refusal'
    },
  }
}
