import { Database } from 'lucide-react'
import { AuthLayout } from './AuthLayout'

/** Se muestra cuando faltan las variables públicas de Supabase. Nada se simula. */
export function SetupRequiredPage() {
  return (
    <AuthLayout>
      <div className="mb-6 grid size-14 place-items-center rounded-full bg-champagne-100 text-gold-600">
        <Database className="size-6" strokeWidth={1.5} />
      </div>
      <p className="eyebrow mb-3">Configuración inicial</p>
      <h2 className="mb-3 text-4xl">Supabase no está configurado</h2>
      <p className="mb-6 text-sm leading-relaxed text-cocoa-500">
        El panel necesita un proyecto de Supabase para autenticar usuarios y guardar el contenido. Definí estas variables
        públicas en <code className="rounded bg-cream-200 px-1">.env</code> (local) o en Netlify:
      </p>
      <pre className="overflow-x-auto rounded-xl bg-cocoa-800 p-4 text-xs leading-relaxed text-champagne-200">
        VITE_SUPABASE_URL=…{'\n'}VITE_SUPABASE_ANON_KEY=…
      </pre>
      <p className="mt-6 text-xs text-cocoa-400">
        La clave service role nunca va en estas variables: solo en el servidor. Ver README → Puesta en marcha.
      </p>
    </AuthLayout>
  )
}
