import { ApiError, validateLabel } from '@/lib/server/ai'

export type Label = ReturnType<typeof validateLabel>
export type WineReading = Label & { labelText: string; brand?: string | null; background?: string | null; knowledge?: Label; japanese?: import('./wineDisplay').JapaneseWine }
export type WineResearch = {
  status: 'catalog' | 'verified' | 'unverified' | 'unavailable' | 'knowledge'
  source: string | null
  catalogId: string | null
  brand?: string | null
  background?: string | null
}
export const normalizeWineText = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ')
const quality = /^(?:guarda superior|premium|reserva|reserve|gran reserva|brut|brut nature|extra brut|extra dry|doc|docg|aoc|aop|igt)$/i

// These are observations, not an identity. A brand/quality term is not a producer/region.
export function readWineLabel(raw: Record<string, unknown>): WineReading {
  const label = validateLabel(raw)
  if (typeof raw.labelText !== 'string' || !raw.labelText.trim() || raw.labelText.length > 2400) throw new ApiError('invalid_ai_result', 502)
  const text = normalizeWineText(raw.labelText)
  for (const field of ['producer', 'region', 'country', 'grapeVariety'] as const) {
    const value = label[field]
    if (value && (!text.includes(normalizeWineText(value)) || quality.test(value.trim()))) label[field] = null
  }
  if (label.producer && /^(proyecto|project|bubbles|cu4tro|cuz4tro)$/i.test(label.producer)) label.producer = null
  if (label.vintage && !new RegExp(`\\b${label.vintage}\\b`).test(text)) label.vintage = null
  return { ...label, labelText: raw.labelText.trim() }
}

// Versioned, reviewed facts shared by every user. Never learn a catalog entry from
// one model response. Source describes the cuvee, not an exact vintage/percentage.
export function findReviewedWine(reading: WineReading) {
  const text = normalizeWineText(reading.labelText)
  const cu4tro = /\b(?:cu4tro|cu 4 tro|cuz4tro|cuatro)\b/.test(text)
  const premiumReserva = /\bpremium reserva\b/.test(text)
  const cava = /\b(?:cava|bubbles)\b/.test(text)
  if (!cu4tro || !premiumReserva || !cava || /\b(?:rose|rosado|rosat|tinto|red|soles)\b/.test(text)) return null
  const source = 'https://www.enoteca.jp/brand/spain/clos_montblanc/'
  return {
    wineName: 'Proyecto Cu4tro Cava Premium Reserva', producer: 'Clos Montblanc',
    vintage: reading.vintage, country: 'Spain', region: 'Catalunya', wineType: 'sparkling',
    grapeVariety: 'Macabeo, Xarel·lo, Parellada, Chardonnay', criticScores: [],
    reviewedJapanese: {wineName:'プロジェクト・クワトロ・カヴァ・プレミアム・レゼルヴァ',producer:'クロ・モンブラン',country:'スペイン',region:'カタルーニャ',grapeVariety:'マカベオ、チャレッロ、パレリャーダ、シャルドネ'},
    grapeResearch: { status: 'verified' as const, source, vintageMatched: false, blendRatio: null },
    wineResearch: { status: 'catalog' as const, source, catalogId: 'clos-montblanc/proyecto-cu4tro-cava-premium-reserva' },
  }
}

export function unverifiedWine(reading: WineReading, status: 'unverified' | 'unavailable' = 'unverified') {
  // Keep the printed name/year as a draft; do not present role assignments as facts.
  return { ...reading, producer: null, region: null, country: null,
    wineResearch: { status, source: null, catalogId: null } as WineResearch }
}

// A short product-specific passage is required, so sidebar/related products cannot
// validate an entire page. Values must be copied in the original source language.
export function verifyWineIdentity(raw: Record<string, unknown>, document: string, reading: WineReading): Label | null {
  if (raw.wineMatched !== true || typeof raw.identityEvidence !== 'string' || raw.identityEvidence.length > 1600) return null
  const evidence = normalizeWineText(raw.identityEvidence)
  if (!evidence || !normalizeWineText(document).includes(evidence)) return null
  const candidate = raw.identity
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null
  let label: Label
  try { label = validateLabel({ ...candidate, vintage: reading.vintage }) } catch { return null }
  if (!label.wineName || !label.producer) return null
  if (![label.wineName, label.producer].every(v => evidence.includes(normalizeWineText(v)))) return null
  const tokens = normalizeWineText(reading.labelText).split(' ').filter(t => t.length >= 4 && !/^(proyecto|project|wine|bubbles|premium|reserve|reserva|superior|guarda|brut|cava|bottle|estate|france|spain|chateau|domaine|\d+)$/.test(t))
  const anchors = [...new Set(tokens)].filter(t => evidence.includes(t))
  if (!anchors.length || (anchors.length < 2 && anchors[0].length < 6)) return null
  const observed = normalizeWineText(reading.labelText)
  for (const variant of ['premium', 'reserva', 'reserve', 'rose', 'rosado', 'blanc de blancs']) {
    if (new RegExp(`\\b${variant}\\b`).test(observed) && !new RegExp(`\\b${variant}\\b`).test(evidence)) return null
  }
  for (const field of ['region', 'country'] as const) {
    const quote=raw[`${field}Evidence`]
    const fieldEvidence=typeof quote==='string' && quote.length<=400 && normalizeWineText(document).includes(normalizeWineText(quote)) ? normalizeWineText(quote) : evidence
    if (label[field] && (!fieldEvidence.includes(normalizeWineText(label[field]!)) || quality.test(label[field]!))) label[field] = null
  }
  label.grapeVariety = null // Varieties are verified separately against the varietal section.
  return label
}
