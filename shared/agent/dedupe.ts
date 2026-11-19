/**
 * Detección de contenido repetitivo. Compara una propuesta con los temas usados
 * recientemente (función SQL `recent_topics`) y con títulos recientes.
 */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const STOP = new Set(['de', 'la', 'el', 'en', 'y', 'a', 'los', 'las', 'del', 'por', 'para', 'con', 'un', 'una', 'tu', 'que', 'al', 'o'])

export function tokens(s: string): Set<string> {
  return new Set(normalize(s).split(' ').filter((t) => t.length > 2 && !STOP.has(t)))
}

export function jaccard(a: string, b: string): number {
  const A = tokens(a)
  const B = tokens(b)
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const t of A) if (B.has(t)) inter++
  return inter / (A.size + B.size - inter)
}

export interface RecentItem {
  topic_key: string | null
  title?: string
}

export function repetitionReason(
  candidate: { topic_key: string | null; title: string },
  recent: RecentItem[],
  threshold = 0.6,
): string | null {
  for (const r of recent) {
    if (candidate.topic_key && r.topic_key && candidate.topic_key === r.topic_key)
      return `El tema "${r.topic_key}" ya se usó recientemente.`
    if (r.title && jaccard(candidate.title, r.title) >= threshold) return `Muy similar a "${r.title}".`
  }
  return null
}
