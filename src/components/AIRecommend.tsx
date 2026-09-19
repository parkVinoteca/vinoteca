'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { translations, Language } from '@/i18n'
import { calculateTasteProfile, calculateMatchScore, buildMatchReason, TastingRecord } from '@/lib/tastePofile'
import { analyzeImage } from '@/lib/aiClient'
import AnalysisProgress, { type AnalysisStage } from './AnalysisProgress'
import ImageCropModal from './ImageCropModal'
import { TASTE_PROFILE_MIN_RECORDS, TASTE_PROFILE_RECORD_LIMIT } from '@/lib/productConfig'
import type { User } from '@supabase/supabase-js'

interface Props { lang: Language; user: User; onBack: () => void }

export default function AIRecommend({ lang, user, onBack }: Props) {
  const t = translations[lang]
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const [imageUrl, setImageUrl] = useState('')
  const analysisRequest = useRef<AbortController | null>(null)
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage>('analyze')
  useEffect(() => () => analysisRequest.current?.abort(), [])
  const cancelAnalysis = () => { analysisRequest.current?.abort(); setAnalyzing(false); setError(t.analysis.cancelled) }
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [redCount, setRedCount] = useState(0)
  const [whiteCount, setWhiteCount] = useState(0)
  const [usageThisMonth, setUsageThisMonth] = useState(0)
  const [usageLimit, setUsageLimit] = useState(5)
  const [cropFile, setCropFile] = useState<File | null>(null)

  useEffect(() => { loadStats().catch(() => setError(t.common.error)) }, [user.id])

  const loadStats = async () => {
    const { data: tastings } = await supabase
      .from('tastings')
      .select('wine_type')
      .eq('user_id', user.id)
      .or('score.not.is.null,stars.not.is.null')

    if (tastings) {
      const isRed = (v: string | null) => ['red', '레드', '赤ワイン', '赤'].includes(v || '')
      const isWhite = (v: string | null) => ['white', '화이트', '白ワイン', '白'].includes(v || '')
      setRedCount(tastings.filter(t => isRed(t.wine_type)).length)
      setWhiteCount(tastings.filter(t => isWhite(t.wine_type)).length)
    }

    const tokyoMonth = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 7)
    const startOfMonth = new Date(`${tokyoMonth}-01T00:00:00+09:00`)

    const [{ count, error: usageError }, { data: profile }] = await Promise.all([
      supabase.from('ai_usage_logs').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('feature', 'sommelier').gte('created_at', startOfMonth.toISOString()),
      supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle(),
    ])

    if (usageError) throw new Error(t.common.error)
    const plan = profile?.plan || 'free'
    const { data: limits } = await supabase.from('subscription_limits').select('sommelier_monthly_limit').eq('plan', plan).maybeSingle()
    setUsageThisMonth(count || 0)
    setUsageLimit(limits?.sommelier_monthly_limit || (plan === 'paid' ? 50 : 5))
  }

  const analyzeWine = async (cropped: { base64: string; mediaType: string }) => {
    analysisRequest.current?.abort()
    const controller = new AbortController()
    analysisRequest.current = controller
    setImageUrl(`data:${cropped.mediaType};base64,${cropped.base64}`)
    setAnalysisStage('analyze')
    setAnalyzing(true)
    setResult(null)
    setError('')
    try {
      try {
        const aiResult = await analyzeImage('sommelier', cropped, lang, controller.signal)
        if (controller.signal.aborted) return
        setAnalysisStage('organize')
        let tasteProfile = null
        const relevantCount = aiResult.wineType === 'red' ? redCount : aiResult.wineType === 'white' ? whiteCount : 0
        const canMatch = relevantCount >= TASTE_PROFILE_MIN_RECORDS
        if (canMatch && aiResult.wineType) {
          const { data, error } = await supabase.from('tastings')
            .select('wine_type, body, tannin, acidity, alcohol, grape_variety, country, region, score, stars, created_at')
            .eq('user_id', user.id).eq('wine_type', aiResult.wineType)
            .or('score.not.is.null,stars.not.is.null')
            .order('created_at', { ascending: false }).order('id', { ascending: false })
            .limit(TASTE_PROFILE_RECORD_LIMIT)
          if (error) throw new Error(t.common.error)
          const records = (data || []) as TastingRecord[]
          tasteProfile = calculateTasteProfile(records)
        }

        // 매칭 점수는 코드가 직접 계산 (AI 재호출 없음, 무료, 즉시)
        let finalResult: any = { ...aiResult, matchScore: null, matchReason: '', matchRecordCount: relevantCount }

        if (canMatch && tasteProfile && aiResult.bodyLevel !== undefined) {
          const matchResult = calculateMatchScore(tasteProfile, {
            body: aiResult.bodyLevel,
            tannin: aiResult.tanninLevel,
            acidity: aiResult.acidityLevel,
            alcohol: aiResult.alcoholLevel,
            grape: aiResult.grapeVariety,
            region: aiResult.region,
            country: aiResult.country,
          })
          finalResult.matchScore = matchResult.score
          finalResult.matchReason = buildMatchReason(lang, matchResult)
        } else {
          finalResult.matchReason = lang === 'ja'
            ? `このタイプの好みの記録が不足しています（赤${redCount}/3本、白${whiteCount}/3本）。4.0 / 5以上の構造データが必要です。`
            : `이 유형의 선호 기록이 부족합니다 (레드 ${redCount}/3병, 화이트 ${whiteCount}/3병). 4.0 / 5 이상 기록의 구조 정보가 필요합니다.`
        }

        if (controller.signal.aborted) return
        setResult(finalResult)
        setImageUrl(`data:${cropped.mediaType};base64,${cropped.base64}`)

      } catch (e: any) {
        if (controller.signal.aborted) return
        console.error('Analysis failed:', e)
        setError(
          (lang === 'ja' ? '解析に失敗しました: ' : '분석에 실패했습니다: ') +
          (e?.message || (lang === 'ja' ? '不明なエラー' : '알 수 없는 오류'))
        )
      } finally {
        if (analysisRequest.current === controller) setAnalyzing(false)
        loadStats().catch(() => {})
      }
    } catch (e) {
      console.error(e)
      setAnalyzing(false)
      setError(t.common.error)
    }
  }

  const handleCropConfirm = (cropped: { base64: string; mediaType: string }) => {
    setCropFile(null)
    analyzeWine(cropped)
  }

  const matchColor = (score: number) =>
    score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400'
  const matchBg = (score: number) =>
    score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-400'
  const countryFlag = (country: string | null | undefined) => {
    const normalized = (country || '').toLowerCase()
    const flags: Record<string, string> = { france: '🇫🇷', フランス: '🇫🇷', 프랑스: '🇫🇷', italy: '🇮🇹', イタリア: '🇮🇹', 이탈리아: '🇮🇹', spain: '🇪🇸', スペイン: '🇪🇸', 스페인: '🇪🇸', japan: '🇯🇵', 日本: '🇯🇵', 일본: '🇯🇵', usa: '🇺🇸', 'united states': '🇺🇸', アメリカ: '🇺🇸', 미국: '🇺🇸', australia: '🇦🇺', オーストラリア: '🇦🇺', 호주: '🇦🇺', germany: '🇩🇪', ドイツ: '🇩🇪', 독일: '🇩🇪' }
    return flags[normalized] || ''
  }

  const canMatch = redCount >= TASTE_PROFILE_MIN_RECORDS || whiteCount >= TASTE_PROFILE_MIN_RECORDS

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="section-title">{t.recommend.title}</div>
      <div className="text-sm text-gold-200 mb-1">{t.recommend.subtitle}</div>
      <div className="text-xs text-cave-200 mb-4">💡 {t.recommend.infoOnly}</div>

      {!canMatch && (
        <div className="card p-3 mb-4">
          <div className="text-xs text-gold-700 tracking-wider uppercase mb-2">
            {lang === 'ja' ? '相性診断の解放条件' : '취향 진단 해금 조건'}
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs text-cave-100 mb-1">
                <span>{lang === 'ja' ? '赤ワイン' : '레드 와인'}</span>
                <span>{redCount}/3</span>
              </div>
              <div className="h-1.5 bg-cave-600/50 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-gold-500 to-gold-600 rounded-full transition-all" style={{ width: `${Math.min(redCount / 3 * 100, 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-cave-100 mb-1">
                <span>{lang === 'ja' ? '白ワイン' : '화이트 와인'}</span>
                <span>{whiteCount}/3</span>
              </div>
              <div className="h-1.5 bg-cave-600/50 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-gold-500 to-gold-600 rounded-full transition-all" style={{ width: `${Math.min(whiteCount / 3 * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      <p className={`text-sm mb-3 ${usageThisMonth >= usageLimit - 1 ? 'text-gold-700 font-medium' : 'text-cave-100'}`}>
        {lang === 'ja' ? `今月の利用回数: ${usageThisMonth} / ${usageLimit}回` : `이번 달 사용 횟수: ${usageThisMonth} / ${usageLimit}회`}
        <span className="block text-xs font-normal mt-1">{lang === 'ja' ? '解析開始後の失敗も利用回数に含まれます。' : '분석 시작 후 실패한 요청도 횟수에 포함됩니다.'}</span>
      </p>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) setCropFile(file) }} />
      <input ref={uploadRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) setCropFile(file) }} />

      {cropFile && (
        <ImageCropModal
          file={cropFile}
          lang={lang}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropFile(null)}
        />
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <button onClick={() => fileRef.current?.click()} disabled={analyzing || usageThisMonth >= usageLimit}
          className="border-2 border-dashed border-gold-900/40 py-8 text-center text-cave-100 hover:border-gold-500/50 transition-colors rounded-lg disabled:opacity-50">
          <div className="text-2xl mb-1">📷</div>
          <div className="text-xs">{lang === 'ja' ? '撮影' : '촬영'}</div>
        </button>
        <button onClick={() => uploadRef.current?.click()} disabled={analyzing || usageThisMonth >= usageLimit}
          className="border-2 border-dashed border-gold-900/40 py-8 text-center text-cave-100 hover:border-gold-500/50 transition-colors rounded-lg disabled:opacity-50">
          <div className="text-2xl mb-1">🖼️</div>
          <div className="text-xs">{lang === 'ja' ? 'アップロード' : '업로드'}</div>
        </button>
      </div>

      {analyzing && <AnalysisProgress imageUrl={imageUrl} lang={lang} stage={analysisStage} mode="sommelier" onCancel={cancelAnalysis} />}

      {error && (
        <div role="alert" className="text-xs text-red-300 bg-red-900/20 border border-red-800/40 p-3 rounded mb-4">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {imageUrl && <img src={imageUrl} alt="" className="w-full max-h-48 object-contain bg-cave-700/30 rounded" />}

          <div className="card p-4">
            <div className="font-serif italic text-xl text-gold-200">{result.wineName}</div>
            <dl className="mt-3 divide-y divide-cave-400/50 text-sm">
              {[[lang === 'ja' ? '生産者' : '생산자', result.producer], [lang === 'ja' ? 'タイプ' : '유형', result.wineType], [lang === 'ja' ? 'ヴィンテージ' : '빈티지', result.vintage], [lang === 'ja' ? '生産地' : '생산지', [countryFlag(result.country), result.country, result.region].filter(Boolean).join(' ')], [lang === 'ja' ? '品種' : '품종', result.grapeVariety]].filter(([, value]) => value).map(([label, value]) => (
                <div key={String(label)} className="grid grid-cols-[88px_1fr] gap-3 py-2"><dt className="text-cave-100">{label}</dt><dd className="font-medium text-ink">{value}</dd></div>
              ))}
            </dl>
          </div>

          {result.blendRatio && (
            <div className="card p-4">
              <div className="text-xs tracking-wider uppercase text-gold-700 mb-2">
                {lang === 'ja' ? 'ブレンド比率' : '블렌딩 비율'}
              </div>
              <div className="text-sm text-ink font-medium">{result.blendRatio}</div>
              {result.blendSource && (
                <div className="text-xs text-cave-200 mt-1.5">
                  {lang === 'ja' ? '出典: ' : '출처: '}{result.blendSource}
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-cave-100">{lang === 'ja' ? '価格は日本市場の参考情報です。構造・相性スコアは推定であり、好みの確率ではありません。' : '가격은 일본 시장의 참고 정보입니다. 구조·취향 점수는 추정치이며 선호 확률이 아닙니다.'}</p>
          {result.sources?.length > 0 && <div className="card p-3 text-xs"><div>{lang === 'ja' ? '調査出典' : '조사 출처'}</div>{result.sources.map((source: { url: string; title: string }, i: number) => <a key={`${source.url}-${i}`} href={source.url} target="_blank" rel="noopener noreferrer" className="block underline mt-2 break-words">{source.title || source.url}</a>)}</div>}
          {(result.priceJPY || result.priceUSD) && (
            <div className="card p-4">
              <div className="text-xs tracking-wider uppercase text-gold-700 mb-2">
                {lang === 'ja' ? '参考価格' : '참고 가격'}
              </div>
              {result.priceJPY && (
                <div className="mb-1">
                  <span className="text-lg font-serif text-gold-200">{result.priceJPY}</span>
                  {result.priceJPYSource && <span className="text-xs text-cave-200 ml-2">({result.priceJPYSource})</span>}
                </div>
              )}
              {result.priceUSD && (
                <div>
                  <span className="text-sm text-cave-50">🌍 {result.priceUSD}</span>
                  {result.priceUSDSource && <span className="text-xs text-cave-200 ml-2">({result.priceUSDSource})</span>}
                </div>
              )}
            </div>
          )}

          {result.drinkingWindow && (
            <div className="card p-4">
              <div className="text-[12px] font-semibold text-cave-200 mb-2">
                {lang === 'ja' ? '飲み頃の目安' : '음용 적기'}
              </div>
              <div className="text-xl font-serif text-ink">{result.drinkingWindow}</div>
              {result.drinkingWindowNow && <div className="text-sm text-cave-50 mt-1">{result.drinkingWindowNow}</div>}
              <div className="text-xs text-cave-200 mt-2">
                {result.drinkingWindowBasis === 'exact_vintage'
                  ? (lang === 'ja' ? 'このヴィンテージの資料に基づく目安' : '해당 빈티지 자료에 근거한 예상')
                  : (lang === 'ja' ? '同銘柄・産地の一般的な傾向' : '동일 와인·산지의 일반적 경향')}
              </div>
              {result.drinkingWindowSource && (
                <a href={result.drinkingWindowSource} target="_blank" rel="noopener noreferrer" className="block text-xs underline break-all mt-2">
                  {lang === 'ja' ? '根拠を見る' : '근거 보기'}
                </a>
              )}
            </div>
          )}

          <div className="card p-4">
            <div className="text-xs font-medium text-ink mb-3">{t.recommend.match}</div>
            {result.matchScore !== null && result.matchScore !== undefined ? (
              <div className="flex items-center gap-4">
                <div className={`font-serif text-5xl font-bold ${matchColor(result.matchScore)}`}>{result.matchScore}</div>
                <div className="flex-1">
                  <div className="h-3 bg-cave-600/50 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${matchBg(result.matchScore)}`} style={{ width: `${result.matchScore}%` }} />
                  </div>
                  <div className="text-xs text-cave-100 mt-2">{result.matchReason}</div>
                  <div className="text-xs text-cave-200 mt-1">{lang === 'ja' ? `${result.matchRecordCount}件の記録に基づく参考値です。` : `${result.matchRecordCount}건의 기록에 근거한 참고값입니다.`}</div>
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
              <div className="text-xs font-medium text-ink mb-2">{lang === 'ja' ? 'ワインの特徴' : '와인 특징'}</div>
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
                <div className="text-xs text-cave-200">{lang === 'ja' ? 'おすすめシーン' : '추천 상황'}</div>
                <div className="text-sm text-cave-50">{result.recommendedFor}</div>
              </div>
            </div>
          )}

          <button onClick={() => uploadRef.current?.click()} className="btn-secondary w-full">
            {lang === 'ja' ? '別のワインを解析' : '다른 와인 분석'}
          </button>
        </div>
      )}

      {usageThisMonth >= usageLimit && <div className="mt-5 rounded-lg border border-gold-500 bg-gold-50 p-3 text-sm text-gold-800">{lang === 'ja' ? '今月の利用上限に達しました。プラン変更機能は決済連携時に提供予定です。' : '이번 달 이용 한도에 도달했습니다. 플랜 변경 기능은 결제 연동 단계에서 제공할 예정입니다.'}</div>}
    </div>
  )
}
