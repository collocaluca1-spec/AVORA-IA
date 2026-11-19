import { useEffect, useState } from 'react'
import { getSetting, saveSetting, type SettingsKey, type SettingsMap } from '@/lib/api/settings'
import { friendlyError } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'

export function useSettingForm<K extends SettingsKey>(key: K) {
  const toast = useToast()
  const [value, setValue] = useState<SettingsMap[K] | null>(null)
  const [initial, setInitial] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () =>
    getSetting(key)
      .then((v) => {
        setValue(v)
        setInitial(JSON.stringify(v))
      })
      .catch((e) => setError(friendlyError(e)))

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  async function save() {
    if (!value) return
    setSaving(true)
    try {
      await saveSetting(key, value)
      setInitial(JSON.stringify(value))
      toast.success('Configuración guardada.')
    } catch (e) {
      toast.error(friendlyError(e))
      load()
    } finally {
      setSaving(false)
    }
  }

  const patch = (p: Partial<SettingsMap[K]>) => setValue((v) => (v ? { ...v, ...p } : v))
  return { value, patch, save, saving, error, dirty: value !== null && JSON.stringify(value) !== initial, reload: load }
}
