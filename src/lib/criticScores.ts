export type CriticScore = { critic: 'WS' | 'WA' | 'JS'; score: number; source: string; evidence: string; vintage: string }
export function readableCriticScores(value: unknown): CriticScore[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is CriticScore => !!item && ['WS','WA','JS'].includes(item.critic) && Number.isInteger(item.score) && item.score >= 50 && item.score <= 100 && typeof item.source === 'string' && /^https:\/\/[^\s]+$/.test(item.source) && typeof item.evidence === 'string' && !!item.evidence.trim() && /^\d{4}$/.test(item.vintage))
}
const normalized = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\p{L}]+/gu,' ').trim()
// Fail closed: source must have actually been fetched, and the exact wine, vintage,
// critic and score must share a quoted passage. No appellation/other-vintage ratings.
export function verifyCriticScores(value: unknown, documents: Map<string, string>, label: { wineName: string | null; producer: string | null; vintage: string | null }): CriticScore[] {
  if (!label.wineName || !label.producer || !label.vintage) return []
  const names = { WS: /wine spectator|\bws\b/i, WA: /wine advocate|robert parker|\bwa\b/i, JS: /james suckling|\bjs\b/i }
  const result: CriticScore[] = []
  for (const item of readableCriticScores(value)) {
    const document = documents.get(item.source)
    const quote = normalized(item.evidence)
    if (!document || item.vintage !== label.vintage || item.evidence.length > 1200 || !normalized(document).includes(quote)) continue
    if (![label.wineName,label.producer,label.vintage].every(part => quote.includes(normalized(part)))) continue
    // The critic name must be adjacent to its points to avoid borrowing another critic's score.
    if (/\b\d{2,3}\s*[-–—]\s*\d{2,3}\b/.test(item.evidence)) continue
    const years = item.evidence.match(/\b(?:19|20)\d{2}\b/g) || []
    if (years.some(year => year !== label.vintage)) continue
    const scorePattern = new RegExp(`(?:${names[item.critic].source})\\s*[:：–—-]?\\s*${item.score}\\b|\\b${item.score}\\s*(?:points?|pts?\\.?|点|점)?\\s*[:：–—-]?\\s*(?:${names[item.critic].source})`, 'i')
    if (!scorePattern.test(item.evidence) || result.some(r => r.critic === item.critic)) continue
    result.push(item)
  }
  return result
}
