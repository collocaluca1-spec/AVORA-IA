import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { AuthLayout } from './AuthLayout'

export function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 10) return setError('Usá al menos 10 caracteres.')
    setBusy(true)
    const { error } = await db().auth.updateUser({ password })
    setBusy(false)
    if (error) setError(error.message)
    else nav('/', { replace: true })
  }

  return (
    <AuthLayout>
      <p className="eyebrow mb-3">Seguridad</p>
      <h2 className="mb-8 text-4xl">Nueva contraseña</h2>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Contraseña" hint="Mínimo 10 caracteres.">
          <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Guardar contraseña
        </Button>
      </form>
    </AuthLayout>
  )
}
