import { createAnthropicProvider } from './anthropic.ts'

/**
 * Proveedores de IA de texto. Si falta la configuración, `resolveTextProvider()`
 * devuelve `null` y el agente responde "not_configured": no hay respuestas simuladas.
 * Para sumar otro proveedor, agregar su adaptador a REGISTRY.
 */
export interface GenerateJSONArgs {
  system: string
  prompt: string
  /** Descripción de la forma JSON esperada (se incluye en el prompt y se valida después) */
  schemaHint: string
  maxTokens?: number
  /** El proveedor debe poder citar fuentes web para tareas de investigación */
  needsWebSources?: boolean
  /** Máximo de búsquedas web en la tarea */
  webSearchMaxUses?: number
}

export interface TextProvider {
  name: string
  supportsWebSources: boolean
  generateJSON(args: GenerateJSONArgs): Promise<unknown>
  /** Llamada real y barata para comprobar la clave */
  verify(): Promise<boolean>
}

type Factory = (apiKey: string) => TextProvider

const REGISTRY: Record<string, Factory> = {
  anthropic: createAnthropicProvider,
}

export function resolveTextProvider(): { provider: TextProvider | null; reason?: string } {
  const name = process.env.AI_TEXT_PROVIDER?.trim().toLowerCase()
  const key = process.env.AI_TEXT_API_KEY?.trim()
  if (!name || !key) return { provider: null, reason: 'La IA de texto no está configurada en el servidor.' }
  const factory = REGISTRY[name]
  if (!factory) return { provider: null, reason: `El proveedor "${name}" todavía no tiene adaptador implementado.` }
  return { provider: factory(key) }
}
