import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { AuthLayout } from './AuthLayout'

export function LoginPage() {
  const { session, signIn, sendPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  if (session) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      if (mode === 'login') await signIn(email.trim(), password)
      else {
        await sendPasswordReset(email.trim())
        setInfo('Si el correo pertenece al equipo, vas a recibir un enlace para restablecer la contraseña.')
      }
    } catch (err) {
      const msg = (err as Error).message
      setError(msg.includes('Invalid login') ? 'Correo o contraseña incorrectos.' : msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      <p className="eyebrow mb-3">{mode === 'login' ? 'Bienvenido' : 'Recuperar acceso'}</p>
      <h2 className="mb-2 text-4xl">{mode === 'login' ? 'Ingresar al panel' : 'Restablecer contraseña'}</h2>
      <p className="mb-8 text-sm text-cocoa-500">
        {mode === 'login'
          ? 'Usá la cuenta que te asignó un administrador.'
          : 'Te enviaremos un enlace por correo electrónico.'}
      </p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Correo electrónico" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {mode === 'login' && (
          <Field label="Contraseña" htmlFor="password">
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        )}
        {error && <p className="rounded-xl bg-rose-100/70 px-3.5 py-2.5 text-sm text-rose-600">{error}</p>}
        {info && <p className="rounded-xl bg-sage-100 px-3.5 py-2.5 text-sm text-sage-600">{info}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          {mode === 'login' ? 'Ingresar' : 'Enviar enlace'}
        </Button>
      </form>
      <button
        className="mt-6 text-sm text-cocoa-500 underline-offset-4 hover:text-cocoa-800 hover:underline"
        onClick={() => {
          setMode(mode === 'login' ? 'reset' : 'login')
          setError(null)
          setInfo(null)
        }}
      >
        {mode === 'login' ? '¿Olvidaste tu contraseña?' : 'Volver a ingresar'}
      </button>
    </AuthLayout>
  )
}
