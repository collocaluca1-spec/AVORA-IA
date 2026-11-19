import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import type { ContentAsset } from '@shared/content'
import { signedUrls } from '@/lib/api/assets'
import { cn } from '../ui/cn'

/** Muestra un archivo del bucket privado mediante URL firmada. */
export function useSignedUrl(path: string | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    if (!path) {
      setUrl(null)
      return
    }
    signedUrls([path])
      .then((m) => alive && setUrl(m[path] ?? null))
      .catch(() => alive && setUrl(null))
    return () => {
      alive = false
    }
  }, [path])
  return url
}

export function MediaView({
  asset,
  src,
  mime,
  className,
  controls,
}: {
  asset?: ContentAsset
  src?: string
  mime?: string
  className?: string
  controls?: boolean
}) {
  const signed = useSignedUrl(src ? undefined : asset?.storage_path)
  const url = src ?? signed
  const type = mime ?? asset?.mime_type ?? ''
  if (!url)
    return (
      <div className={cn('grid place-items-center bg-cream-200 text-cocoa-400', className)}>
        <ImageOff className="size-5" strokeWidth={1.25} />
      </div>
    )
  if (type.startsWith('video/'))
    return (
      <video
        src={url}
        className={cn('object-cover', className)}
        muted
        playsInline
        loop
        controls={controls}
        preload="metadata"
      />
    )
  return <img src={url} alt={asset?.alt_text ?? ''} className={cn('object-cover', className)} loading="lazy" />
}
