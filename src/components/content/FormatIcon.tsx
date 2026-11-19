import { Clapperboard, GalleryHorizontal, RectangleVertical, Smartphone, Square } from 'lucide-react'
import type { ContentFormat } from '@shared/content'

const ICONS = {
  post_portrait: RectangleVertical,
  post_square: Square,
  story: Smartphone,
  reel: Clapperboard,
  carousel: GalleryHorizontal,
} as const

export function FormatIcon({ format, className = 'size-4' }: { format: ContentFormat; className?: string }) {
  const Icon = ICONS[format]
  return <Icon className={className} strokeWidth={1.5} />
}
