'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { translations, Language } from '@/i18n'
import { calculateTasteProfile, calculateMatchScore, buildMatchReason, TastingRecord } from '@/lib/tastePofile'
import { analyzeImage } from '@/lib/aiClient'
import ImageCropModal from './ImageCropModal'
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
  const [cropFile, setCropFile] = useState<File | null>(null)

  useEffect(() => { loadStats().catch(() => setError(t.common.error)) }, [user.id])

  const loadStats = async () => {
    const { data: tastings } = await supabase
      .from('tastings')
      .select('wine_type')
      .eq('user_id', user.id)
      .not('score', 'is', null)

    if (tastings) {
      const isRed = (v: string | null) => ['red', '레드', '赤ワイン', '赤'].includes(v || '')
      const isWhite = (v: string | null) => ['white', '화이트', '白ワイン', '白'].includes(v || '')
      setRedCount(tastings.filter(t => isRed(t.wine_type)).length)
      setWhiteCount(tastings.filter(t => isWhite(t.wine_type)).length)
    }

    const tokyoMonth = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 7)
    const startOfMonth = new Date(`${tokyoMonth}-01T00:00:00+09:00`)

    const { count, error: usageError } = await supabase
      .from('ai_usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('feature', 'sommelier')
      .gte('created_at', startOfMonth.toISOString())

    if (usageError) throw new Error(t.common.error)
    setUsageThisMonth(count || 0)
  }

  const analyzeWine = async (cropped: { base64: string; mediaType: string }) => {
    setAnalyzing(true)
    setResult(null)
    setError('')
    try {
      const canMatch = redCount >= 10 && whiteCount >= 10

      // Compare only the same wine type; red and white structures must not be mixed.

      try {
        const aiResult = await analyzeImage('sommelier', cropped, lang)
        let tasteProfile = null
        if (canMatch && aiResult.wineType) {
          const records: TastingRecord[] = []
          for (let from = 0; ; from += 500) {
            const { data, error } = await supabase.from('tastings')
              .select('wine_type, body, tannin, acidity, alcohol, grape_variety, country, region, score')
              .eq('user_id', user.id).eq('wine_type', aiResult.wineType).not('score', 'is', null)
              .order('created_at').order('id').range(from, from + 499)
            if (error) throw new Error(t.common.error)
            records.push(...(data || [])); if (!data || data.length < 500) break
          }
          tasteProfile = calculateTasteProfile(records)
        }

        // 매칭 점수는 코드가 직접 계산 (AI 재호출 없음, 무료, 즉시)
        let finalResult: any = { ...aiResult, matchScore: null, matchReason: '' }

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
            ? `同じタイプの好みの記録が不足しています（赤${redCount}/10本、白${whiteCount}/10本必要）。7点以上のワインの構造データも必要です。`
            : `같은 유형의 선호 기록이 부족합니다 (레드 ${redCount}/10병, 화이트 ${whiteCount}/10병 필요). 7점 이상 평가한 와인의 구조 정보도 필요합니다.`
        }

        setResult(finalResult)
        setImageUrl(`data:${cropped.mediaType};base64,${cropped.base64}`)

      } catch (e: any) {
        console.error('Analysis failed:', e)
        setError(
          (lang === 'ja' ? '解析に失敗しました: ' : '분석에 실패했습니다: ') +
          (e?.message || (lang === 'ja' ? '不明なエラー' : '알 수 없는 오류'))
        )
      } finally {
        setAnalyzing(false)
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

      <p className="text-xs text-cave-100 mb-3">{lang === 'ja' ? 'AIソムリエは1日20回・月100回まで。解析開始後の失敗も利用回数に含まれます。' : 'AI 소믈리에는 하루 20회·월 100회까지입니다. 분석 시작 후 실패한 요청도 횟수에 포함됩니다.'}</p>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => e.target.files?.[0] && setCropFile(e.target.files[0])} />
      <input ref={uploadRef} type="file" accept="image/*" className="hidden"
        onChange={e => e.target.files?.[0] && setCropFile(e.target.files[0])} />

      {cropFile && (
        <ImageCropModal
          file={cropFile}
          lang={lang}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropFile(null)}
        />
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <button onClick={() => fileRef.current?.click()} disabled={analyzing}
          className="border-2 border-dashed border-gold-900/40 py-8 text-center text-cave-100 hover:border-gold-500/50 transition-colors rounded-lg disabled:opacity-50">
          <div className="text-2xl mb-1">📷</div>
          <div className="text-xs">{lang === 'ja' ? '撮影' : '촬영'}</div>
        </button>
        <button onClick={() => uploadRef.current?.click()} disabled={analyzing}
          className="border-2 border-dashed border-gold-900/40 py-8 text-center text-cave-100 hover:border-gold-500/50 transition-colors rounded-lg disabled:opacity-50">
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
        <div role="alert" className="text-xs text-red-300 bg-red-900/20 border border-red-800/40 p-3 rounded mb-4">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {imageUrl && <img src={imageUrl} alt="" className="w-full max-h-48 object-contain bg-cave-700/30 rounded" />}

          <div className="card p-4">
            <div className="font-serif italic text-xl text-gold-200">{result.wineName}</div>
            {result.producer && <div className="text-sm text-cave-100">{result.producer}</div>}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[result.vintage, result.region, result.country].filter(Boolean).map((d: string) => (
                <span key={d} className="text-xs bg-cave-600/40 px-2 py-0.5 text-cave-50 rounded-full">{d}</span>
              ))}
            </div>
            {result.expertScore && <div className="text-xs text-gold-400 mt-2">⭐ {result.expertScore}</div>}
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

          <p className="text-xs text-cave-100">{lang === 'ja' ? '価格は日本市場の参考情報です。構造・相性スコアは推定であり、好みの確率ではありません。' : '가격은 일본 시장의 참고 정보입니다. 구조·취향 점수는 추정치이며 선호 확률이 아닙니다.'}</p>
          {result.sources?.length > 0 && <div className="card p-3 text-xs"><div>{lang === 'ja' ? '調査出典' : '조사 출처'}</div>{result.sources.map((source: { url: string; title: string }, i: number) => <a key={`${source.url}-${i}`} href={source.url} target="_blank" rel="noopener noreferrer" className="block underline mt-2 break-words">{source.title || source.url}</a>)}</div>}
          {(result.priceJPY || result.priceUSD) && (
            <div className="card p-4">
              <div className="text-[10px] tracking-widest uppercase text-gold-400 mb-2">
                {lang === 'ja' ? '参考価格' : '참고 가격'}
              </div>
              {result.priceJPY && (
                <div className="mb-1">
                  <span className="text-lg font-serif text-gold-200">{result.priceJPY}</span>
                  {result.priceJPYSource && <span className="text-[10px] text-cave-200 ml-2">({result.priceJPYSource})</span>}
                </div>
              )}
              {result.priceUSD && (
                <div>
                  <span className="text-sm text-cave-50">🌍 {result.priceUSD}</span>
                  {result.priceUSDSource && <span className="text-[10px] text-cave-200 ml-2">({result.priceUSDSource})</span>}
                </div>
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
                <div className="text-[10px] text-cave-200">{lang === 'ja' ? 'おすすめシーン' : '추천 상황'}</div>
                <div className="text-sm text-cave-50">{result.recommendedFor}</div>
              </div>
            </div>
          )}

          <button onClick={() => uploadRef.current?.click()} className="btn-secondary w-full">
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
