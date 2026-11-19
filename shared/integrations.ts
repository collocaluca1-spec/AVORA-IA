/**
 * Catálogo de integraciones externas. El estado real vive en la tabla
 * `integrations` y SOLO lo modifica el servidor (service role) después de
 * comprobar las credenciales. El panel nunca marca una integración como conectada.
 */
export const INTEGRATION_KEYS = [
  'ai_text',
  'ai_image',
  'ai_video',
  'stock_media',
  'instagram',
  'n8n',
  'travel_providers',
] as const
export type IntegrationKey = (typeof INTEGRATION_KEYS)[number]

export type IntegrationStatus =
  | 'not_configured' // no hay credenciales en el servidor
  | 'credentials_present' // hay credenciales pero todavía no se verificó la conexión
  | 'connected' // verificada contra el servicio real
  | 'error' // la verificación falló
  | 'disabled' // desactivada manualmente

export interface IntegrationDef {
  key: IntegrationKey
  name: string
  description: string
  /** Variables de entorno del servidor (Netlify) que la habilitan */
  envVars: string[]
  phase: string
}

export const INTEGRATIONS: Record<IntegrationKey, IntegrationDef> = {
  ai_text: {
    key: 'ai_text',
    name: 'IA de texto',
    description: 'Investigación de destinos, ideas, textos comerciales y consejos de viaje.',
    envVars: ['AI_TEXT_PROVIDER', 'AI_TEXT_API_KEY'],
    phase: 'Fase 2',
  },
  ai_image: {
    key: 'ai_image',
    name: 'IA de imágenes',
    description: 'Generación de imágenes para posts, historias y carruseles.',
    envVars: ['AI_IMAGE_PROVIDER', 'AI_IMAGE_API_KEY'],
    phase: 'Fase 2',
  },
  ai_video: {
    key: 'ai_video',
    name: 'IA de video',
    description: 'Generación de Reels y videos para historias.',
    envVars: ['AI_VIDEO_PROVIDER', 'AI_VIDEO_API_KEY'],
    phase: 'Fase 3',
  },
  stock_media: {
    key: 'stock_media',
    name: 'Banco de fotos y videos (Pexels)',
    description: 'Fotos y videos reales de destinos para cada publicación, con crédito al autor.',
    envVars: ['PEXELS_API_KEY'],
    phase: 'Fase 2',
  },
  instagram: {
    key: 'instagram',
    name: 'Instagram',
    description: 'Publicación vía API oficial (Instagram Graph API, cuenta profesional).',
    envVars: ['INSTAGRAM_BUSINESS_ACCOUNT_ID', 'INSTAGRAM_ACCESS_TOKEN'],
    phase: 'Fase 3',
  },
  n8n: {
    key: 'n8n',
    name: 'n8n',
    description: 'Orquestación de automatizaciones y flujos programados.',
    envVars: ['N8N_WEBHOOK_URL', 'N8N_WEBHOOK_SECRET'],
    phase: 'Fase 3',
  },
  travel_providers: {
    key: 'travel_providers',
    name: 'Proveedores turísticos',
    description: 'Fuentes verificables de paquetes y tarifas. Requisito para publicar precios.',
    envVars: [],
    phase: 'Fase 4',
  },
}

export const INTEGRATION_STATUS_LABELS: Record<IntegrationStatus, string> = {
  not_configured: 'No configurado',
  credentials_present: 'Credenciales cargadas · sin verificar',
  connected: 'Conectado',
  error: 'Error de conexión',
  disabled: 'Desactivado',
}
