import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { AuthLayout } from './AuthLayout'

export function NoAccessPage() {
  const { session, signOut, refreshProfile } = useAuth()
  return (
    <AuthLayout>
      <div className="mb-6 grid size-14 place-items-center rounded-full bg-champagne-100 text-gold-600">
        <ShieldAlert className="size-6" strokeWidth={1.5} />
      </div>
      <h2 className="mb-3 text-4xl">Cuenta sin acceso</h2>
      <p className="mb-8 text-sm leading-relaxed text-cocoa-500">
        La cuenta <strong className="font-normal text-cocoa-800">{session?.user.email}</strong> existe, pero todavía no
        tiene un rol asignado. Pedile a un administrador que te habilite desde Configuración → Equipo.
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={refreshProfile}>
          Volver a comprobar
        </Button>
        <Button variant="ghost" onClick={signOut}>
          Cerrar sesión
        </Button>
      </div>
    </AuthLayout>
  )
}
