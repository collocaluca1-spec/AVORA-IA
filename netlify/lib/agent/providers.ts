/**
 * Proveedores de IA de texto.
 *
 * Fase 1: solo existe la interfaz. No hay ningún proveedor implementado, por lo
 * que `resolveTextProvider()` devuelve `null` y el agente responde
 * "not_configured". No hay respuestas simuladas.
 *
 * Fase 2: agregar un adaptador por proveedor en REGISTRY (p. ej. 'anthropic'),
 * que lea su clave de process.env.AI_TEXT_API_KEY y respete la interfaz.
 */
export interface GenerateJSONArgs {
  system: string
  prompt: string
  /** Descripción de la forma JSON esperada (se incluye en el prompt y se valida después) */
  schemaHint: string
  maxTokens?: number
  /** El proveedor debe poder citar fuentes web para tareas de investigación */
  needsWebSources?: boolean
}

export interface TextProvider {
  name: string
  supportsWebSources: boolean
  generateJSON(args: GenerateJSONArgs): Promise<unknown>
}

type Factory = (apiKey: string) => TextProvider

const REGISTRY: Record<string, Factory> = {
  // 'anthropic': (key) => createAnthropicProvider(key),   ← Fase 2
}

export function resolveTextProvider(): { provider: TextProvider | null; reason?: string } {
  const name = process.env.AI_TEXT_PROVIDER?.trim().toLowerCase()
  const key = process.env.AI_TEXT_API_KEY?.trim()
  if (!name || !key) return { provider: null, reason: 'La IA de texto no está configurada en el servidor.' }
  const factory = REGISTRY[name]
  if (!factory) return { provider: null, reason: `El proveedor "${name}" todavía no tiene adaptador implementado.` }
  return { provider: factory(key) }
}
