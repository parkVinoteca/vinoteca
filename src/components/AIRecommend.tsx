'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { translations, Language } from '@/i18n'
import type { User } from '@supabase/supabase-js'

interface Props { lang: Language; user: User; onBack: () => void }

export default function AIRecommend({ lang, user, onBack }: Props) {
  const t = translations[lang]
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [redCount, setRedCount] = useState(0)
  const [whiteCount, setWhiteCount] = useState(0)
  const [usageThisMonth, setUsageThisMonth] = useState(0)

  useEffect(() => { loadStats() }, [])

  const loadStats = async () => {
    const { data: tastings } = await supabase
      .from('tastings')
      .select('wine_type')
      .eq('user_id', user.id)
      .not('score', 'is', null)

    if (tastings) {
      const isRed = (v: string) => ['red', '레드', '赤ワイン', '赤'].includes(v)
      const isWhite = (v: string) => ['white', '화이트', '白ワイン', '白'].includes(v)
      setRedCount(tastings.filter(t => isRed(t.wine_type)).length)
      setWhiteCount(tastings.filter(t => isWhite(t.wine_type)).length)
    }

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count } = await supabase
      .from('ai_usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('feature', 'sommelier')
      .gte('created_at', startOfMonth.toISOString())

    setUsageThisMonth(count || 0)
  }

  const analyzeWine = async (file: File) => {
    setAnalyzing(true)
    setResult(null)
    setError('')
    try {
      const { data: history } = await supabase
        .from('tastings')
        .select('wine_name, producer, country, grape_variety, score, body, tannin, acidity, wine_type')
        .eq('user_id', user.id)
        .not('score', 'is', null)
        .order('score', { ascending: false })
        .limit(15)

      const canMatch = redCount >= 10 && whiteCount >= 10

      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1]

        const matchInstructionJa = canMatch
          ? `ユーザーの過去の評価データ（赤${redCount}本、白${whiteCount}本、上位15件）: ${JSON.stringify(history)}\nこのデータと比較して相性スコア(0-100)を算出してください。`
          : `ユーザーの評価本数が不足しています（赤${redCount}/10本、白${whiteCount}/10本必要）。matchScoreはnullとし、matchReasonには「記録を増やすとより正確な相性診断ができます（あと赤${Math.max(0,10-redCount)}本・白${Math.max(0,10-whiteCount)}本）」と入れてください。`

        const matchInstructionKo = canMatch
          ? `사용자의 과거 평가 데이터 (레드 ${redCount}병, 화이트 ${whiteCount}병, 상위 15건): ${JSON.stringify(history)}\n이 데이터와 비교해서 취향 일치도(0-100)를 산출해주세요.`
          : `사용자의 평가 병수가 부족합니다 (레드 ${redCount}/10병, 화이트 ${whiteCount}/10병 필요). matchScore는 null로 하고, matchReason에는 "기록이 쌓이면 더 정확한 취향 진단이 가능합니다 (레드 ${Math.max(0,10-redCount)}병・화이트 ${Math.max(0,10-whiteCount)}병 더 필요)"라고 넣어주세요.`

        const prompt = lang === 'ja'
          ? `このワインラベルの写真を分析してください。Google検索を積極的に使い、以下を正確に調査してください：

1. ラベルから読み取れる基本情報（生産者、ワイン名、ヴィンテージ、産地、品種）
2. 【重要・必須検索】このワインの正確なヴィンテージ別ブレンド比率。生産者の公式サイト、Vivino、Wine-Searcherを検索して特定してください。ラベルの記載だけでなく、必ずWeb検索で裏付けを取ってください。
3. 【重要・必須検索】参考価格。まず日本国内のショップ（エノテカ、テラダワイン等）を検索し円で提示。国内情報がなければ海外相場をドルで検索して提示してください。
4. ${matchInstructionJa}

必ずGoogle検索ツールを使用し、実際の検索結果に基づいて回答してください。不明な項目は「不明」としてください。

回答は以下のJSON形式のみで、他のテキストは含めないでください:
{
  "wineName": "ワイン名",
  "producer": "生産者",
  "vintage": "ヴィンテージ",
  "region": "産地",
  "country": "国",
  "wineType": "red/white/rose/sparkling",
  "blendRatio": "品種構成（例: CS 60%, メルロー 30%, CF 10%）",
  "blendSource": "情報の出典",
  "description": "ワインの特徴（2-3文）",
  "characteristics": ["特徴1", "特徴2", "特徴3"],
  "priceJPY": "国内参考価格（円）または null",
  "priceJPYSource": "出典サイト名 または null",
  "priceUSD": "海外参考価格（ドル、国内情報がない場合のみ）または null",
  "priceUSDSource": "出典サイト名 または null",
  "expertScore": "専門家評価（あれば）",
  "matchScore": ${canMatch ? '数値(0-100)' : 'null'},
  "matchReason": "相性診断の理由、または本数不足メッセージ",
  "recommendedFor": "おすすめのシーン・料理"
}`
          : `이 와인 라벨 사진을 분석해주세요. Google 검색을 적극 활용해서 다음을 정확히 조사해주세요:

1. 라벨에서 읽을 수 있는 기본 정보 (생산자, 와인명, 빈티지, 산지, 품종)
2. 【중요・필수 검색】이 와인의 정확한 빈티지별 블렌딩 비율. 생산자 공식 사이트, Vivino, Wine-Searcher를 검색해서 찾아주세요. 라벨 표기뿐 아니라 반드시 웹 검색으로 근거를 확인해주세요.
3. 【중요・필수 검색】참고 가격. 먼저 국내 쇼핑몰을 검색해서 원화로 제시. 국내 정보가 없으면 해외 시세를 달러로 검색해서 제시해주세요.
4. ${matchInstructionKo}

반드시 Google 검색 도구를 사용하고, 실제 검색 결과에 기반해서 답해주세요. 모르는 항목은 "불명"으로 표기하세요.

답변은 아래 JSON 형식으로만, 다른 텍스트는 포함하지 마세요:
{
  "wineName": "와인 이름",
  "producer": "생산자",
  "vintage": "빈티지",
  "region": "산지",
  "country": "나라",
  "wineType": "red/white/rose/sparkling",
  "blendRatio": "품종 구성 (예: CS 60%, 메를로 30%, CF 10%)",
  "blendSource": "정보 출처",
  "description": "와인 특징 (2-3문장)",
  "characteristics": ["특징1", "특징2", "특징3"],
  "priceJPY": "국내 참고가격 (원화) 또는 null",
  "priceJPYSource": "출처 사이트명 또는 null",
  "priceUSD": "해외 참고가격 (달러, 국내 정보 없을 때만) 또는 null",
  "priceUSDSource": "출처 사이트명 또는 null",
  "expertScore": "전문가 평가 (있으면)",
  "matchScore": ${canMatch ? '숫자(0-100)' : 'null'},
  "matchReason": "취향 진단 이유 또는 병수 부족 메시지",
  "recommendedFor": "추천 상황・음식"
}`

        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { text: prompt },
                    { inlineData: { mimeType: file.type, data: base64 } },
                  ],
                }],
                tools: [{ google_search: {} }],
              }),
            }
          )

          if (!res.ok) {
            const errBody = await res.text()
            console.error('Gemini API error response:', res.status, errBody)
            throw new Error(`API ${res.status}: ${errBody.slice(0, 200)}`)
          }

          const data = await res.json()
          console.log('Gemini API response:', data)

          const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('') || ''
          const jsonMatch = text.match(/\{[\s\S]*\}/)
          if (!jsonMatch) {
            console.error('No JSON found in text:', text)
            throw new Error('No valid JSON in response')
          }

          const info = JSON.parse(jsonMatch[0])
          setResult(info)

          const objUrl = URL.createObjectURL(file)
          setImageUrl(objUrl)

          await supabase.from('ai_usage_logs').insert({ user_id: user.id, feature: 'sommelier' })
          setUsageThisMonth(prev => prev + 1)
        } catch (e: any) {
          console.error('Analysis failed:', e)
          setError(
            (lang === 'ja' ? '解析に失敗しました: ' : '분석에 실패했습니다: ') +
            (e?.message || (lang === 'ja' ? '不明なエラー' : '알 수 없는 오류'))
          )
        } finally {
          setAnalyzing(false)
        }
      }
      reader.readAsDataURL(file)
    } catch (e) {
      console.error(e)
      setAnalyzing(false)
      setError(t.common.error)
    }
  }

  const matchColor = (score: number) =>
    score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400'
  const matchBg = (score: number) =>
    score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-400'

  const canMatch = redCount >= 10 && whiteCount >= 10

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="section-title">{t.recommend.title}</div>
      <div className="text-sm text-gold-200 mb-1">{t.recommend.subtitle}</div>
      <div className="text-[11px] text-cave-200 mb-4">💡 {t.recommend.infoOnly}</div>

      {!canMatch && (
        <div className="card p-3 mb-4">
          <div className="text-[10px] text-gold-400 tracking-widest uppercase mb-2">
            {lang === 'ja' ? '相性診断の解放条件' : '취향 진단 해금 조건'}
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[11px] text-cave-100 mb-1">
                <span>{lang === 'ja' ? '赤ワイン' : '레드 와인'}</span>
                <span>{redCount}/10</span>
              </div>
              <div className="h-1.5 bg-cave-600/50 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-gold-500 to-gold-600 rounded-full transition-all" style={{ width: `${Math.min(redCount / 10 * 100, 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-cave-100 mb-1">
                <span>{lang === 'ja' ? '白ワイン' : '화이트 와인'}</span>
                <span>{whiteCount}/10</span>
              </div>
              <div className="h-1.5 bg-cave-600/50 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-gold-500 to-gold-600 rounded-full transition-all" style={{ width: `${Math.min(whiteCount / 10 * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => e.target.files?.[0] && analyzeWine(e.target.files[0])}
      />
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => e.target.files?.[0] && analyzeWine(e.target.files[0])}
      />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={analyzing}
          className="border-2 border-dashed border-gold-900/40 py-8 text-center text-cave-100 hover:border-gold-500/50 transition-colors rounded-lg disabled:opacity-50"
        >
          <div className="text-2xl mb-1">📷</div>
          <div className="text-xs">{lang === 'ja' ? '撮影' : '촬영'}</div>
        </button>
        <button
          onClick={() => uploadRef.current?.click()}
          disabled={analyzing}
          className="border-2 border-dashed border-gold-900/40 py-8 text-center text-cave-100 hover:border-gold-500/50 transition-colors rounded-lg disabled:opacity-50"
        >
          <div className="text-2xl mb-1">🖼️</div>
          <div className="text-xs">{lang === 'ja' ? 'アップロード' : '업로드'}</div>
        </button>
      </div>

      {analyzing && (
        <div className="text-center mb-4">
          <div className="text-3xl animate-pulse">🔍</div>
          <div className="text-sm mt-2 text-gold-200">{lang === 'ja' ? 'AIが調査中...' : 'AI가 조사 중...'}</div>
          <div className="text-[10px] text-cave-200 mt-1">
            {lang === 'ja' ? 'ブレンド比率・価格をWeb検索しています' : '블렌딩 비율·가격을 검색 중입니다'}
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-300 bg-red-900/20 border border-red-800/40 p-3 rounded mb-4">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {imageUrl && (
            <img src={imageUrl} alt="" className="w-full max-h-48 object-contain bg-cave-700/30 rounded" />
          )}

          <div className="card p-4">
            <div className="font-serif italic text-xl text-gold-200">{result.wineName}</div>
            {result.producer && <div className="text-sm text-cave-100">{result.producer}</div>}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[result.vintage, result.region, result.country].filter(Boolean).map((d: string) => (
                <span key={d} className="text-xs bg-cave-600/40 px-2 py-0.5 text-cave-50 rounded-full">{d}</span>
              ))}
            </div>
            {result.expertScore && (
              <div className="text-xs text-gold-400 mt-2">⭐ {result.expertScore}</div>
            )}
          </div>

          {result.blendRatio && (
            <div className="card p-4">
              <div className="text-[10px] tracking-widest uppercase text-gold-400 mb-2">
                {lang === 'ja' ? 'ブレンド比率' : '블렌딩 비율'}
              </div>
              <div className="text-sm text-ink font-medium">{result.blendRatio}</div>
              {result.blendSource && (
                <div className="text-[10px] text-cave-200 mt-1.5">
                  {lang === 'ja' ? '出典: ' : '출처: '}{result.blendSource}
                </div>
              )}
            </div>
          )}

          {(result.priceJPY || result.priceUSD) && (
            <div className="card p-4">
              <div className="text-[10px] tracking-widest uppercase text-gold-400 mb-2">
                {lang === 'ja' ? '参考価格' : '참고 가격'}
              </div>
              {result.priceJPY && (
                <div className="mb-1">
                  <span className="text-lg font-serif text-gold-200">{result.priceJPY}</span>
                  {result.priceJPYSource && (
                    <span className="text-[10px] text-cave-200 ml-2">({result.priceJPYSource})</span>
                  )}
                </div>
              )}
              {result.priceUSD && (
                <div>
                  <span className="text-sm text-cave-50">🌍 {result.priceUSD}</span>
                  {result.priceUSDSource && (
                    <span className="text-[10px] text-cave-200 ml-2">({result.priceUSDSource})</span>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="card p-4">
            <div className="text-xs font-medium text-ink mb-3">{t.recommend.match}</div>
            {result.matchScore !== null && result.matchScore !== undefined ? (
              <div className="flex items-center gap-4">
                <div className={`font-serif text-5xl font-bold ${matchColor(result.matchScore)}`}>
                  {result.matchScore}
                </div>
                <div className="flex-1">
                  <div className="h-3 bg-cave-600/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${matchBg(result.matchScore)}`}
                      style={{ width: `${result.matchScore}%` }}
                    />
                  </div>
                  <div className="text-xs text-cave-100 mt-2">{result.matchReason}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-cave-100">
                <span className="text-2xl">🔒</span>
                <div className="text-xs">{result.matchReason}</div>
              </div>
            )}
          </div>

          {result.description && (
            <div className="card p-4">
              <div className="text-xs font-medium text-ink mb-2">
                {lang === 'ja' ? 'ワインの特徴' : '와인 특징'}
              </div>
              <div className="text-sm text-cave-50 leading-relaxed">{result.description}</div>
              {result.characteristics && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {result.characteristics.map((c: string) => (
                    <span key={c} className="chip chip-on text-xs">{c}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {result.recommendedFor && (
            <div className="card p-3 flex items-center gap-3">
              <span className="text-2xl">🥂</span>
              <div>
                <div className="text-[10px] text-cave-200">{lang === 'ja' ? 'おすすめシーン' : '추천 상황'}</div>
                <div className="text-sm text-cave-50">{result.recommendedFor}</div>
              </div>
            </div>
          )}

          <button onClick={() => fileRef.current?.click()} className="btn-secondary w-full">
            {lang === 'ja' ? '別のワインを解析' : '다른 와인 분석'}
          </button>
        </div>
      )}

      <div className="mt-6 text-center text-[10px] text-cave-200">
        {lang === 'ja' ? `今月の利用回数: ${usageThisMonth}回` : `이번 달 사용 횟수: ${usageThisMonth}회`}
      </div>
    </div>
  )
}
