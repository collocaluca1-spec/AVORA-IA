import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/auth/AuthProvider'
import { isSupabaseConfigured } from '@/lib/env'
import { ToastProvider } from '@/components/ui/Toast'
import { PageLoader } from '@/components/ui/Spinner'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { NoAccessPage } from '@/pages/NoAccessPage'
import { SetupRequiredPage } from '@/pages/SetupRequiredPage'

const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const StudioPage = lazy(() => import('@/pages/StudioPage'))
const LibraryPage = lazy(() => import('@/pages/LibraryPage'))
const ApprovalsPage = lazy(() => import('@/pages/ApprovalsPage'))
const CalendarPage = lazy(() => import('@/pages/CalendarPage'))
const AgentPage = lazy(() => import('@/pages/AgentPage'))
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'))
const ActivityPage = lazy(() => import('@/pages/ActivityPage'))

function Protected() {
  const { session, loading, hasAccess } = useAuth()
  if (loading) return <PageLoader label="Verificando acceso…" />
  if (!session) return <Navigate to="/ingresar" replace />
  if (!hasAccess) return <NoAccessPage />
  return <AppShell />
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupRequiredPage />
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/ingresar" element={<LoginPage />} />
              <Route path="/restablecer" element={<ResetPasswordPage />} />
              <Route element={<Protected />}>
                <Route index element={<DashboardPage />} />
                <Route path="estudio" element={<StudioPage />} />
                <Route path="estudio/:id" element={<StudioPage />} />
                <Route path="contenidos" element={<LibraryPage />} />
                <Route path="aprobaciones" element={<ApprovalsPage />} />
                <Route path="calendario" element={<CalendarPage />} />
                <Route path="agente" element={<AgentPage />} />
                <Route path="configuracion" element={<SettingsPage />} />
                <Route path="configuracion/:section" element={<SettingsPage />} />
                <Route path="actividad" element={<ActivityPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
