import { listProfiles, setRole, type Role } from '@/lib/api/team'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/auth/AuthProvider'
import { friendlyError } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Field'
import { PageLoader } from '@/components/ui/Spinner'
import { ErrorNote } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'

export function TeamSection() {
  const { isAdmin, session } = useAuth()
  const toast = useToast()
  const list = useAsync(listProfiles, [])
  if (list.error) return <ErrorNote message={list.error} />
  if (!list.data) return <PageLoader />

  return (
    <>
      <Card className="divide-y divide-cream-200">
        {list.data.map((p) => (
          <div key={p.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm text-cocoa-800">{p.full_name || p.email}</p>
              <p className="truncate text-xs text-cocoa-500">{p.email}</p>
            </div>
            <Select
              className="sm:w-48"
              value={p.role ?? ''}
              disabled={!isAdmin || p.id === session?.user.id}
              onChange={async (e) => {
                try {
                  await setRole(p.id, (e.target.value || null) as Role | null)
                  toast.success('Rol actualizado.')
                  list.reload()
                } catch (err) {
                  toast.error(friendlyError(err))
                }
              }}
            >
              <option value="">Sin acceso</option>
              <option value="editor">Editor</option>
              <option value="admin">Administrador</option>
            </Select>
          </div>
        ))}
      </Card>
      <p className="mt-4 text-xs leading-relaxed text-cocoa-500">
        Para sumar a alguien: invitalo desde Supabase → Authentication → Users → Invite user. Al aceptar aparece acá "Sin acceso"
        hasta que le asignes un rol. Los editores crean y programan; solo los administradores aprueban, rechazan y configuran.
      </p>
    </>
  )
}
