/** New ratings use stars /5. Legacy /10 scores are scaled only for display; never overwritten. */
export function personalRating(record: { stars?: number | null; score?: number | null }): number | null {
  if (typeof record.stars === 'number' && Number.isFinite(record.stars) && record.stars >= 1 && record.stars <= 5) return Math.round(record.stars * 10) / 10
  if (typeof record.score === 'number' && Number.isFinite(record.score) && record.score >= 1 && record.score <= 10) return Math.round(record.score * 5) / 10
  return null
}
export const formatRating = (record: Parameters<typeof personalRating>[0]) => personalRating(record)?.toFixed(1) ?? '—'
