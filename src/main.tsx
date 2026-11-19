import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { logClientError } from '@/lib/api/activity'
import './index.css'

// Enlaces de invitación o recuperación de Supabase: llevar a "Nueva contraseña".
// Se conserva el hash para que Supabase pueda leer la sesión.
if (/type=(invite|recovery)/.test(location.hash) && location.pathname !== '/restablecer') {
  history.replaceState(null, '', '/restablecer' + location.hash)
}

// Registro de errores no controlados en activity_log (si hay sesión).
window.addEventListener('error', (e) => logClientError('ui.error', e.message))
window.addEventListener('unhandledrejection', (e) => logClientError('ui.unhandled_rejection', String(e.reason?.message ?? e.reason)))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
