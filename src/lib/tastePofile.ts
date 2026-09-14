// 취향 프로필 계산 로직 — AI 호출 없이 순수 계산

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
}

export interface TasteProfile {
  count: number
  avgScore: number
  bodyScore: number      // 1-5 (light-full)
  tanninScore: number    // 1-5
  acidityScore: number   // 1-5
  alcoholScore: number   // 1-5
  topGrapes: string[]
  topRegions: string[]
  topCountries: string[]
}

// 텍스트 등급을 숫자로 변환 (다국어 대응)
function scaleToNumber(value: string | null): number | null {
  if (!value) return null
  const v = value.toLowerCase()
  if (v.includes('light') || v.includes('라이트') || v.includes('低') || v.includes('낮음') || v.includes('軽')) return 1
  if (v.includes('med-') || v.includes('중간-') || v.includes('中程度-')) return 2
  if (v.includes('medium') || v.includes('中程度') || v.includes('미디엄') || v.includes('중간')) return 3
  if (v.includes('med+') || v.includes('중간+') || v.includes('中程度+')) return 4
  if (v.includes('full') || v.includes('high') || v.includes('풀바디') || v.includes('높음') || v.includes('強') || v.includes('高')) return 5
  return 3 // 기본값
}

function countTop(items: (string | null)[], topN = 3): string[] {
  const counts: Record<string, number> = {}
  items.forEach(item => {
    if (!item) return
    counts[item] = (counts[item] || 0) + 1
  })
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name]) => name)
}

export function calculateTasteProfile(records: TastingRecord[]): TasteProfile | null {
  const scored = records.filter(r => r.score !== null)
  if (scored.length === 0) return null

  const avg = (nums: number[]) => nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 3

  const bodyScores = scored.map(r => scaleToNumber(r.body)).filter((n): n is number => n !== null)
  const tanninScores = scored.map(r => scaleToNumber(r.tannin)).filter((n): n is number => n !== null)
  const acidityScores = scored.map(r => scaleToNumber(r.acidity)).filter((n): n is number => n !== null)
  const alcoholScores = scored.map(r => scaleToNumber(r.alcohol)).filter((n): n is number => n !== null)

  // 평점 8점 이상만 "선호"로 간주해서 품종/산지 추출
  const preferred = scored.filter(r => (r.score || 0) >= 7)

  return {
    count: scored.length,
    avgScore: Math.round(avg(scored.map(r => r.score || 0)) * 10) / 10,
    bodyScore: Math.round(avg(bodyScores) * 10) / 10,
    tanninScore: Math.round(avg(tanninScores) * 10) / 10,
    acidityScore: Math.round(avg(acidityScores) * 10) / 10,
    alcoholScore: Math.round(avg(alcoholScores) * 10) / 10,
    topGrapes: countTop(preferred.map(r => r.grape_variety)),
    topRegions: countTop(preferred.map(r => r.region)),
    topCountries: countTop(preferred.map(r => r.country)),
  }
}

// 새 와인과 취향 프로필의 구조적 유사도 계산 (0-100) + 설명 데이터 반환
export function calculateMatchScore(
  profile: TasteProfile,
  newWine: { body?: number; tannin?: number; acidity?: number; alcohol?: number; grape?: string; region?: string; country?: string }
): { score: number; grapeMatched: boolean; regionMatched: boolean; structureDiff: number } {
  let structureScore = 100
  let totalDiff = 0
  let factors = 0

  if (newWine.body !== undefined) {
    const diff = Math.abs(profile.bodyScore - newWine.body)
    structureScore -= diff * 10
    totalDiff += diff
    factors++
  }
  if (newWine.tannin !== undefined) {
    const diff = Math.abs(profile.tanninScore - newWine.tannin)
    structureScore -= diff * 10
    totalDiff += diff
    factors++
  }
  if (newWine.acidity !== undefined) {
    const diff = Math.abs(profile.acidityScore - newWine.acidity)
    structureScore -= diff * 8
    totalDiff += diff
    factors++
  }
  if (newWine.alcohol !== undefined) {
    const diff = Math.abs(profile.alcoholScore - newWine.alcohol)
    structureScore -= diff * 6
    totalDiff += diff
    factors++
  }

  structureScore = Math.max(0, Math.min(100, structureScore))

  const grapeMatched = !!(newWine.grape && profile.topGrapes.some(g => newWine.grape?.includes(g) || g.includes(newWine.grape || '')))
  const regionMatched = !!(newWine.region && profile.topRegions.some(r => newWine.region?.includes(r) || r.includes(newWine.region || '')))
  const countryMatched = !!(newWine.country && profile.topCountries.some(c => newWine.country?.includes(c) || c.includes(newWine.country || '')))

  let matchBonus = 0
  if (grapeMatched) matchBonus += 15
  if (regionMatched) matchBonus += 10
  if (countryMatched) matchBonus += 5

  const scoreWeight = (profile.avgScore - 5) * 2
  const finalScore = structureScore * 0.6 + Math.min(100, matchBonus * 2) * 0.3 + (50 + scoreWeight) * 0.1

  return {
    score: Math.round(Math.max(0, Math.min(100, finalScore))),
    grapeMatched,
    regionMatched,
    structureDiff: factors > 0 ? totalDiff / factors : 0,
  }
}

// 매칭 결과를 사람이 읽을 수 있는 설명 문구로 변환 (AI 호출 없이 템플릿 기반)
export function buildMatchReason(
  lang: 'ja' | 'ko',
  matchResult: { score: number; grapeMatched: boolean; regionMatched: boolean; structureDiff: number }
): string {
  const { score, grapeMatched, regionMatched, structureDiff } = matchResult
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
