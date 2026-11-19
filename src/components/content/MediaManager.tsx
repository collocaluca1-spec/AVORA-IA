import { useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, ImagePlus, Trash2 } from 'lucide-react'
import { FORMAT_SPECS, type ContentAsset, type ContentFormat } from '@shared/content'
import { inspectFile, type LocalMedia } from '@/lib/api/assets'
import { MediaView } from './MediaThumb'
import { cn } from '../ui/cn'

export type MediaEntry =
  | { kind: 'existing'; key: string; asset: ContentAsset }
  | { kind: 'new'; key: string; local: LocalMedia }

export const entryMeta = (e: MediaEntry) =>
  e.kind === 'existing'
    ? { mime_type: e.asset.mime_type, width: e.asset.width, height: e.asset.height }
    : { mime_type: e.local.mime, width: e.local.width, height: e.local.height }

const ACCEPT = { image: 'image/jpeg,image/png,image/webp', video: 'video/mp4,video/quicktime' }
const MAX_BYTES = 100 * 1024 * 1024

export function MediaManager({
  format,
  entries,
  onChange,
  onRemove,
  disabled,
}: {
  format: ContentFormat
  entries: MediaEntry[]
  onChange: (e: MediaEntry[]) => void
  onRemove: (e: MediaEntry) => void
  disabled?: boolean
}) {
  const spec = FORMAT_SPECS[format]
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [warn, setWarn] = useState<string | null>(null)
  const accept = spec.accepts.map((a) => ACCEPT[a]).join(',')
  const full = entries.length >= spec.maxAssets

  async function addFiles(files: FileList | File[]) {
    setWarn(null)
    const list = Array.from(files)
    const room = spec.maxAssets - entries.length
    const next: MediaEntry[] = []
    for (const f of list.slice(0, Math.max(0, room))) {
      const kind = f.type.startsWith('video/') ? 'video' : f.type.startsWith('image/') ? 'image' : null
      if (!kind || !spec.accepts.includes(kind)) {
        setWarn(`${f.name}: ${spec.label} no admite este tipo de archivo.`)
        continue
      }
      if (f.size > MAX_BYTES) {
        setWarn(`${f.name}: supera los 100 MB.`)
        continue
      }
      next.push({ kind: 'new', key: crypto.randomUUID(), local: await inspectFile(f) })
    }
    if (list.length > room) setWarn(`Máximo ${spec.maxAssets} pieza(s) para ${spec.label.toLowerCase()}.`)
    if (spec.maxAssets === 1 && next.length && entries.length) {
      entries.forEach(onRemove)
      onChange(next.slice(0, 1))
    } else onChange([...entries, ...next])
  }

  function move(i: number, d: -1 | 1) {
    const j = i + d
    if (j < 0 || j >= entries.length) return
    const copy = [...entries]
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    onChange(copy)
  }

  return (
    <div className="space-y-3">
      {entries.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {entries.map((e, i) => {
            const m = entryMeta(e)
            return (
              <div key={e.key} className="group relative overflow-hidden rounded-xl bg-cream-200 ring-1 ring-cream-300" style={{ aspectRatio: `${spec.width}/${spec.height}` }}>
                {e.kind === 'existing' ? (
                  <MediaView asset={e.asset} className="absolute inset-0 size-full" />
                ) : (
                  <MediaView src={e.local.previewUrl} mime={e.local.mime} className="absolute inset-0 size-full" />
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-4 text-[0.6rem] text-white">
                  <span>{m.width && m.height ? `${m.width}×${m.height}` : m.mime_type.split('/')[1]}</span>
                  {e.kind === 'new' && <span className="rounded bg-gold-500 px-1">nuevo</span>}
                </div>
                {!disabled && (
                  <div className="absolute inset-x-0 top-0 flex justify-between p-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                    <div className="flex gap-0.5">
                      {entries.length > 1 && (
                        <>
                          <IconBtn label="Mover antes" onClick={() => move(i, -1)} disabled={i === 0}>
                            <ArrowLeft className="size-3" />
                          </IconBtn>
                          <IconBtn label="Mover después" onClick={() => move(i, 1)} disabled={i === entries.length - 1}>
                            <ArrowRight className="size-3" />
                          </IconBtn>
                        </>
                      )}
                    </div>
                    <IconBtn
                      label="Quitar"
                      onClick={() => {
                        onRemove(e)
                        onChange(entries.filter((x) => x.key !== e.key))
                      }}
                    >
                      <Trash2 className="size-3" />
                    </IconBtn>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!disabled && (!full || spec.maxAssets === 1) && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            addFiles(e.dataTransfer.files)
          }}
          onClick={() => input.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-7 text-center transition',
            drag ? 'border-gold-500 bg-champagne-100/60' : 'border-sand-400 bg-white/50 hover:border-gold-500 hover:bg-champagne-100/30',
          )}
        >
          <ImagePlus className="size-6 text-gold-500" strokeWidth={1.25} />
          <p className="text-sm text-cocoa-700">
            {full ? 'Reemplazar archivo' : 'Arrastrá archivos o hacé clic para elegir'}
          </p>
          <p className="text-xs text-cocoa-400">
            {spec.accepts.includes('video') && spec.accepts.includes('image') ? 'Imagen o video' : spec.accepts.includes('video') ? 'Video MP4/MOV' : 'Imagen JPG, PNG o WebP'}
            {' · '}
            {spec.width}×{spec.height}
            {spec.maxAssets > 1 && ` · ${spec.minAssets} a ${spec.maxAssets} piezas`}
          </p>
          <input
            ref={input}
            type="file"
            accept={accept}
            multiple={spec.maxAssets > 1}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      )}
      {warn && <p className="text-xs text-amber-600">{warn}</p>}
    </div>
  )
}

function IconBtn({ children, label, onClick, disabled }: { children: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="grid size-6 place-items-center rounded-full bg-white/90 text-cocoa-800 shadow disabled:opacity-30"
    >
      {children}
    </button>
  )
}
