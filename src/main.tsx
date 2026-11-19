import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { logClientError } from '@/lib/api/activity'
import './index.css'

// Registro de errores no controlados en activity_log (si hay sesión).
window.addEventListener('error', (e) => logClientError('ui.error', e.message))
window.addEventListener('unhandledrejection', (e) => logClientError('ui.unhandled_rejection', String(e.reason?.message ?? e.reason)))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
