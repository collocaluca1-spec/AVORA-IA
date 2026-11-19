import { useCallback, useEffect, useRef, useState } from 'react'
import { friendlyError } from '@/lib/supabase'

/** Carga datos asíncronos con estados de carga/error y recarga manual. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const seq = useRef(0)

  const run = useCallback(async () => {
    const id = ++seq.current
    setLoading(true)
    try {
      const r = await fn()
      if (id === seq.current) {
        setData(r)
        setError(null)
      }
    } catch (e) {
      if (id === seq.current) setError(friendlyError(e))
    } finally {
      if (id === seq.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    run()
  }, [run])

  return { data, error, loading, reload: run, setData }
}
