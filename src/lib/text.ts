/** Clave de tema normalizada: "Bariloche, Río Negro" → "bariloche-rio-negro" */
export function topicKey(s: string | null | undefined): string | null {
  if (!s) return null
  const k = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return k || null
}
