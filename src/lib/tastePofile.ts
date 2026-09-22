// 취향 프로필 계산 로직 — AI 호출 없이 순수 계산
import { personalRating } from '@/lib/ratings'
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
  samples: { record: TastingRecord; weight: number; signal: number }[]
  ratingSpread: number
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
  const scored = records.filter(r => personalRating(r) !== null)
  if (scored.length === 0) return null

  const weightedAverage = (values: { value: number; weight: number }[]) => {
    const totalWeight = values.reduce((sum, item) => sum + item.weight, 0)
    return totalWeight ? values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight : 3
  }

  const samples = scored.map((record,index) => ({record,weight:recordWeight(index),signal:0}))
  const average = weightedAverage(samples.map(({record,weight}) => ({value:personalRating(record)!,weight})))
  const deviation = Math.sqrt(weightedAverage(samples.map(({record,weight}) => ({value:(personalRating(record)!-average)**2,weight}))))
  // Centre on this person's ratings, not an arbitrary high-score threshold.
  // Low ratings provide negative evidence; strict scorers still have positive preferences.
  for (const sample of samples) sample.signal = Math.max(-1,Math.min(1,(personalRating(sample.record)!-average)/Math.max(.5,deviation)))
  const preferred = samples.map(sample => ({...sample,weight:sample.weight * Math.exp(sample.signal * 2)}))
  const levelAverage = (field: 'body' | 'tannin' | 'acidity' | 'alcohol') => {
    const values = preferred.map(({ record, weight }) => ({ value: scaleToNumber(record[field]), weight }))
      .filter((item): item is { value: number; weight: number } => item.value !== null)
    return values.length ? Math.round(weightedAverage(values) * 10) / 10 : null
  }

  const scoreValues = scored.map((record, index) => ({
    value: personalRating(record)!, weight: recordWeight(index),
  }))

  return {
    count: scored.length,
    samples,
    ratingSpread: Math.max(...scored.map(r=>personalRating(r)!))-Math.min(...scored.map(r=>personalRating(r)!)),
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
): { score: number | null; grapeMatched: boolean; regionMatched: boolean; structureDiff: number; evidenceCount: number; reason?: 'ratings_similar' | 'insufficient' } {
  const matches = (value: string | null | undefined, other: string | null) => !!value && !!other && normalizeWineTerm(value) === normalizeWineTerm(other)
  const evidence: {signal:number; weight:number; difference:number; grape:boolean; region:boolean}[] = []
  for (const sample of profile.samples) {
    let total=0, weights=0, factors=0
    for (const [field,weight] of [['body',10],['tannin',10],['acidity',8],['alcohol',6]] as const) {
      const target=wine[field], previous=scaleToNumber(sample.record[field])
      if (typeof target !== 'number' || !Number.isFinite(target) || target<1 || target>5 || previous === null) continue
      total+=Math.abs(target-previous)/4*weight; weights+=weight; factors++
    }
    if(factors<2) continue
    const structureDistance=total/weights
    let distance=structureDistance*70, dimensionWeight=70
    for(const [value,other,weight] of [[wine.grape,sample.record.grape_variety,15],[wine.region,sample.record.region,10],[wine.country,sample.record.country,5]] as const) {
      if(value && other) {distance+=(matches(value,other)?0:1)*weight;dimensionWeight+=weight}
    }
    distance/=dimensionWeight
    // Nearby disliked records pull down, nearby liked records pull up. Distant records
    // provide little evidence, rather than being mistaken for disliked styles.
    const similarity=Math.exp(-8*distance)
    evidence.push({signal:sample.signal,weight:similarity*sample.weight,difference:structureDistance*4,grape:matches(wine.grape,sample.record.grape_variety),region:matches(wine.region,sample.record.region)})
  }
  const empty={score:null,grapeMatched:false,regionMatched:false,structureDiff:Infinity,evidenceCount:evidence.length}
  if(evidence.length<3) return {...empty,reason:'insufficient'}
  if(profile.ratingSpread<.2) return {...empty,reason:'ratings_similar'}
  if(Math.max(...evidence.map(e=>e.weight))<.1) return {...empty,reason:'insufficient'}
  const sum=evidence.reduce((n,e)=>n+e.weight,0)
  const signal=evidence.reduce((n,e)=>n+e.signal*e.weight,0)/sum
  // Small samples remain conservative; this is a reference index, not a probability.
  const confidence=Math.min(1,Math.sqrt(evidence.length/8))
  return {score:Math.round(50+50*signal*confidence),grapeMatched:evidence.some(e=>e.grape && e.signal>0),regionMatched:evidence.some(e=>e.region && e.signal>0),structureDiff:evidence.reduce((n,e)=>n+e.difference*e.weight,0)/sum,evidenceCount:evidence.length}
}

// 매칭 결과를 사람이 읽을 수 있는 설명 문구로 변환 (AI 호출 없이 템플릿 기반)
export function buildMatchReason(lang: 'ja' | 'ko', result: ReturnType<typeof calculateMatchScore>): string {
  if (result.score === null) return result.reason === 'ratings_similar'
    ? (lang === 'ja' ? '評価の差がまだ小さいため、好き・苦手の傾向は判断できません。感じたままの点数を記録してください。' : '아직 평점 차이가 작아 선호·비선호를 구분하기 어렵습니다. 느낀 그대로 점수를 남겨주세요.')
    : (lang === 'ja' ? '比較できる特徴を含む記録が不足しています。高い点数でなくても、ボディや酸味を記録すると参考になります。' : '특징을 비교할 수 있는 기록이 부족합니다. 높은 점수가 아니어도 바디나 산미를 기록하면 도움이 됩니다.')
  const tendency = result.score >= 65
    ? (lang === 'ja' ? 'ご自身の中で高く評価したスタイルに近い傾向です。' : '본인이 상대적으로 높게 평가한 스타일과 가까운 편입니다.')
    : result.score <= 35
      ? (lang === 'ja' ? 'ご自身が低く評価したスタイルに近く、好みに合わない可能性があります。' : '본인이 낮게 평가한 스타일과 가까워 취향에 맞지 않을 수 있습니다.')
      : (lang === 'ja' ? '好き・苦手の両方に近い特徴があり、好みはまだ分かれそうです。' : '선호·비선호 기록과 겹치는 특징이 있어 취향에 맞을지는 아직 뚜렷하지 않습니다.')
  return tendency + (lang === 'ja' ? '低い評価も含め、ご自身の採点傾向と比較した参考値です。' : '낮은 평점도 포함해 본인의 채점 경향과 비교한 참고값입니다.')
}
