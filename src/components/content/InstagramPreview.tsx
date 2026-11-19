import { useState } from 'react'
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Send, Bookmark, Clapperboard } from 'lucide-react'
import { FORMAT_SPECS, type ContentAsset, type ContentFormat } from '@shared/content'
import { MediaView } from './MediaThumb'
import { cn } from '../ui/cn'

export interface PreviewMedia {
  key: string
  asset?: ContentAsset
  src?: string
  mime?: string
}

/**
 * Vista previa de referencia del formato (proporciones reales 4:5, 1:1, 9:16).
 * Es solo una maqueta visual: no se conecta con Instagram.
 */
export function InstagramPreview({
  format,
  media,
  caption,
  hashtags,
  brandName = 'avoratravel',
  hideCaption = false,
}: {
  format: ContentFormat
  media: PreviewMedia[]
  caption: string
  hashtags: string[]
  brandName?: string
  hideCaption?: boolean
}) {
  const spec = FORMAT_SPECS[format]
  const [idx, setIdx] = useState(0)
  const i = Math.min(idx, Math.max(0, media.length - 1))
  const current = media[i]
  const vertical = format === 'story' || format === 'reel'

  const frame = (
    <div className="relative w-full overflow-hidden bg-cream-200" style={{ aspectRatio: `${spec.width} / ${spec.height}` }}>
      {current ? (
        <MediaView key={current.key} asset={current.asset} src={current.src} mime={current.mime} className="absolute inset-0 size-full" controls={vertical} />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-center text-xs text-cocoa-400">
          <div>
            <p className="font-display text-lg text-cocoa-500">{spec.width} × {spec.height}</p>
            <p>Sin material visual</p>
          </div>
        </div>
      )}
      {media.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => setIdx((v) => Math.max(0, v - 1))}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1 shadow disabled:opacity-0"
            disabled={i === 0}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => setIdx((v) => Math.min(media.length - 1, v + 1))}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1 shadow disabled:opacity-0"
            disabled={i === media.length - 1}
          >
            <ChevronRight className="size-4" />
          </button>
          <span className="absolute right-2 top-2 rounded-full bg-cocoa-900/60 px-2 py-0.5 text-[0.65rem] text-white">
            {i + 1}/{media.length}
          </span>
        </>
      )}
      {vertical && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/40 to-transparent p-3 text-white">
          <span className="size-6 rounded-full bg-gradient-to-br from-champagne-300 to-gold-500 ring-2 ring-white/70" />
          <span className="text-[0.7rem] font-medium">{brandName}</span>
          {format === 'reel' && <Clapperboard className="ml-auto size-4" />}
        </div>
      )}
    </div>
  )

  return (
    <div className={cn('mx-auto w-full overflow-hidden rounded-[1.6rem] bg-white shadow-lift ring-1 ring-cream-300', vertical ? 'max-w-[270px]' : 'max-w-[340px]')}>
      {!vertical && (
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="size-7 rounded-full bg-gradient-to-br from-champagne-300 to-gold-500 ring-2 ring-champagne-100" />
          <span className="text-[0.78rem] font-medium text-cocoa-900">{brandName}</span>
        </div>
      )}
      {frame}
      {media.length > 1 && (
        <div className="flex justify-center gap-1 py-2">
          {media.map((m, n) => (
            <span key={m.key} className={cn('size-1.5 rounded-full', n === i ? 'bg-sky-600' : 'bg-cream-300')} />
          ))}
        </div>
      )}
      {!vertical && (
        <div className="space-y-1.5 px-3 pb-4 pt-2 text-[0.78rem] text-cocoa-900">
          <div className="flex items-center gap-3 text-cocoa-800">
            <Heart className="size-5" strokeWidth={1.5} />
            <MessageCircle className="size-5" strokeWidth={1.5} />
            <Send className="size-5" strokeWidth={1.5} />
            <Bookmark className="ml-auto size-5" strokeWidth={1.5} />
          </div>
          {!hideCaption && <p className="whitespace-pre-line break-words leading-snug">
            <span className="font-medium">{brandName}</span> {caption || <span className="text-cocoa-400">La descripción aparecerá acá…</span>}
          </p>}
          {!hideCaption && hashtags.length > 0 && <p className="break-words text-sky-600">{hashtags.map((h) => '#' + h).join(' ')}</p>}
        </div>
      )}
    </div>
  )
}
