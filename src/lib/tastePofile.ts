// 취향 프로필 계산 로직 — AI 호출 없이 순수 계산
import { RECENCY_WEIGHT_BANDS } from '@/lib/productConfig'

export interface TastingRecord {
  wine_type: string | null
  body: string | null
  tannin: string | null
  acidity: string | null
  alcohol: string | null
  grape_variety: string | null
  country: string | null
  region: string | null
  score: number | null
  stars?: number | null
  created_at?: string
}

export interface TasteProfile {
  count: number
  avgScore: number
  bodyScore: number | null      // 1-5 (light-full)
  tanninScore: number | null    // 1-5
  acidityScore: number | null   // 1-5
  alcoholScore: number | null   // 1-5
  topGrapes: string[]
  topRegions: string[]
  topCountries: string[]
}

// 텍스트 등급을 숫자로 변환 (다국어 대응)
export function scaleToNumber(value: string | null): number | null {
  if (!value) return null
  const v = value.normalize('NFKC').toLowerCase().replace(/\s/g, '').split('(')[0]
  const scales = [
    ['light','low','라이트','낮음','低い','軽い'],
    ['med-','medium-','중간-','미디엄-','中程度-','ミディアム-'],
    ['med','medium','중간','미디엄','中程度','ミディアム'],
    ['med+','medium+','중간+','미디엄+','中程度+','ミディアム+'],
    ['full','full-bodied','high','풀바디','높음','高い','フルボディ'],
  ]
  const index = scales.findIndex(labels => labels.includes(v))
  return index < 0 ? null : index + 1
}
const aliases: Record<string, string> = {
  'カベルネ・ソーヴィニヨン': 'cabernet sauvignon', '카베르네 소비뇽': 'cabernet sauvignon',
  'ピノ・ノワール': 'pinot noir', '피노 누아': 'pinot noir',
  'シャルドネ': 'chardonnay', '샤르도네': 'chardonnay',
  'メルロー': 'merlot', '메를로': 'merlot', 'メルロ': 'merlot',
  'ソーヴィニヨン・ブラン': 'sauvignon blanc', '소비뇽 블랑': 'sauvignon blanc',
  'リースリング': 'riesling', '리슬링': 'riesling',
  'フランス': 'france', '프랑스': 'france', 'イタリア': 'italy', '이탈리아': 'italy',
  '日本': 'japan', '일본': 'japan', 'スペイン': 'spain', '스페인': 'spain',
}
export function normalizeWineTerm(value: string) {
  const text = value.normalize('NFKC').trim().toLowerCase()
  return aliases[text] || text
}

function recordWeight(index: number): number {
  const position = index + 1
  return RECENCY_WEIGHT_BANDS.find(band => position <= band.through)?.weight ?? 0.3
}

function countTop(items: { value: string | null; weight: number }[], topN = 3): string[] {
  const counts: Record<string, number> = {}
  items.forEach(({ value, weight }) => {
    if (!value) return
    const key = normalizeWineTerm(value)
    counts[key] = (counts[key] || 0) + weight
  })
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name]) => name)
}

export function calculateTasteProfile(records: TastingRecord[]): TasteProfile | null {
  // Callers pass newest first. Keep the weighting deterministic for equal dates.
  const scored = records.filter(r => r.score !== null || r.stars !== null && r.stars !== undefined)
  if (scored.length === 0) return null

  const weightedAverage = (values: { value: number; weight: number }[]) => {
    const totalWeight = values.reduce((sum, item) => sum + item.weight, 0)
    return totalWeight ? values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight : 3
  }

  // Expert 10-point scores and simple 5-star likes both contribute.
  const preferred = scored.map((record, index) => ({ record, weight: recordWeight(index) }))
    .filter(({ record }) => (record.score || 0) >= 7 || (record.stars || 0) >= 4)
  if (!preferred.length) return null
  const levelAverage = (field: 'body' | 'tannin' | 'acidity' | 'alcohol') => {
    const values = preferred.map(({ record, weight }) => ({ value: scaleToNumber(record[field]), weight }))
      .filter((item): item is { value: number; weight: number } => item.value !== null)
    return values.length ? Math.round(weightedAverage(values) * 10) / 10 : null
  }

  const scoreValues = scored.map((record, index) => ({
    value: record.score ?? (record.stars ? record.stars * 2 : 0), weight: recordWeight(index),
  }))

  return {
    count: scored.length,
    avgScore: Math.round(weightedAverage(scoreValues) * 10) / 10,
    bodyScore: levelAverage('body'),
    tanninScore: levelAverage('tannin'),
    acidityScore: levelAverage('acidity'),
    alcoholScore: levelAverage('alcohol'),
    topGrapes: countTop(preferred.map(({ record, weight }) => ({ value: record.grape_variety, weight }))),
    topRegions: countTop(preferred.map(({ record, weight }) => ({ value: record.region, weight }))),
    topCountries: countTop(preferred.map(({ record, weight }) => ({ value: record.country, weight }))),
  }
}

// 새 와인과 취향 프로필의 구조적 유사도 계산 (0-100) + 설명 데이터 반환
export function calculateMatchScore(
  profile: TasteProfile,
  wine: { body?: number | null; tannin?: number | null; acidity?: number | null; alcohol?: number | null; grape?: string | null; region?: string | null; country?: string | null }
): { score: number | null; grapeMatched: boolean; regionMatched: boolean; structureDiff: number } {
  let difference = 0
  let weights = 0
  let factors = 0
  let totalDiff = 0
  for (const [field, weight] of [['body', 10], ['tannin', 10], ['acidity', 8], ['alcohol', 6]] as const) {
    const value = wine[field]
    const reference = profile[`${field}Score`]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 5 || reference === null) continue
    const diff = Math.abs(value - reference)
    difference += diff * weight
    weights += weight
    totalDiff += diff
    factors++
  }
  const matches = (value: string | null | undefined, choices: string[]) => !!value && choices.some(v => normalizeWineTerm(v) === normalizeWineTerm(value))
  const grapeMatched = matches(wine.grape, profile.topGrapes)
  const regionMatched = matches(wine.region, profile.topRegions)
  const countryMatched = matches(wine.country, profile.topCountries)
  if (factors < 2) return { score: null, grapeMatched, regionMatched, structureDiff: Infinity }
  const structure = 100 * (1 - difference / (4 * weights))
  let sum = structure * 70
  let denominator = 70
  for (const [available, matched, weight] of [
    [!!wine.grape && !!profile.topGrapes.length, grapeMatched, 15],
    [!!wine.region && !!profile.topRegions.length, regionMatched, 10],
    [!!wine.country && !!profile.topCountries.length, countryMatched, 5],
  ] as const) {
    if (available) { denominator += weight; sum += (matched ? 100 : 0) * weight }
  }
  return { score: Math.round(Math.max(0, Math.min(100, sum / denominator))), grapeMatched, regionMatched, structureDiff: totalDiff / factors }
}

// 매칭 결과를 사람이 읽을 수 있는 설명 문구로 변환 (AI 호출 없이 템플릿 기반)
export function buildMatchReason(
  lang: 'ja' | 'ko',
  matchResult: { score: number | null; grapeMatched: boolean; regionMatched: boolean; structureDiff: number }
): string {
  const { score, grapeMatched, regionMatched, structureDiff } = matchResult
  if (score === null) return lang === 'ja' ? '構造データが不足しているため相性スコアを計算できません。' : '구조 정보가 부족해 취향 점수를 계산할 수 없습니다.'
  const isCloseStructure = structureDiff < 1

  if (lang === 'ja') {
    const parts: string[] = []
    if (isCloseStructure) parts.push('これまでお好みだった構造(ボディ・タンニン等)に近い')
    if (grapeMatched) parts.push('高評価だった品種と一致')
    if (regionMatched) parts.push('好みの産地と一致')
    if (parts.length === 0) parts.push('過去の記録と構造がやや異なる')
    return `${parts.join('、')}ため、相性スコアは${score}点となりました。`
  } else {
    const parts: string[] = []
    if (isCloseStructure) parts.push('지금까지 선호하신 구조(바디·타닌 등)와 유사')
    if (grapeMatched) parts.push('높은 평점을 준 품종과 일치')
    if (regionMatched) parts.push('선호하는 산지와 일치')
    if (parts.length === 0) parts.push('과거 기록과 구조가 다소 다름')
    return `${parts.join(', ')}하여 취향 일치도는 ${score}점으로 산출됐습니다.`
  }
}
