import { Button } from '@/components/ui/Button'
import { useAuth } from '@/auth/AuthProvider'

export function SaveBar({ dirty, saving, onSave }: { dirty: boolean; saving: boolean; onSave: () => void }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return null
  return (
    <div className="sticky bottom-20 z-10 mt-6 flex items-center justify-end gap-3 lg:bottom-6">
      {dirty && <span className="text-xs text-cocoa-500">Hay cambios sin guardar</span>}
      <Button onClick={onSave} disabled={!dirty} loading={saving}>
        Guardar cambios
      </Button>
    </div>
  )
}
