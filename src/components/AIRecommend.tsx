'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { translations, Language } from '@/i18n'
import type { User } from '@supabase/supabase-js'

interface Props { lang: Language; user: User; onBack: () => void }

export default function AIRecommend({ lang, user, onBack }: Props) {
  const t = translations[lang]
  const fileRef = useRef<HTMLInputElement>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [redCount, setRedCount] = useState(0)
  const [whiteCount, setWhiteCount] = useState(0)
  const [usageThisMonth, setUsageThisMonth] = useState(0)

  useEffect(() => { loadStats() }, [])

  const loadStats = async () => {
    // 레드/화이트 평가 병 수 확인
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

    // 이번 달 소믈리에 사용 횟수
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
      // 취향 히스토리 수집 (매칭용)
      const { data: history } = await supabase
        .from('tastings')
        .select('wine_name, producer, country, grape_variety, score, body, tannin, acidity, wine_type')
        .eq('user_id', user.id)
        .not('score', 'is', null)
        .order('score', { ascending: false })
        .limit(20)

      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1]

        try {
          const res = await fetch('/api/sommelier', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64,
              imageMediaType: file.type,
              lang,
              userStats: { redCount, whiteCount, history },
            }),
          })

          if (!res.ok) {
            const errData = await res.json()
            throw new Error(errData.error || 'Analysis failed')
          }

          const { result: analysisResult } = await res.json()
          setResult(analysisResult)

          const objUrl = URL.createObjectURL(file)
          setImageUrl(objUrl)

          // 사용 로그 기록
          await supabase.from('ai_usage_logs').insert({
            user_id: user.id,
            feature: 'sommelier',
          })
          setUsageThisMonth(prev => prev + 1)
        } catch (e: any) {
          console.error(e)
          setError(lang === 'ja' ? '解析に失敗しました。もう一度お試しください。' : '분석에 실패했습니다. 다시 시도해주세요.')
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

      {/* Match progress indicator */}
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

      <button
        onClick={() => fileRef.current?.click()}
        disabled={analyzing}
        className="w-full border-2 border-dashed border-gold-900/40 py-10 text-center text-cave-100 hover:border-gold-500/50 transition-colors mb-4 rounded-lg"
      >
        {analyzing ? (
          <div>
            <div className="text-3xl animate-pulse">🔍</div>
            <div className="text-sm mt-2 text-gold-200">{lang === 'ja' ? 'AIが調査中...' : 'AI가 조사 중...'}</div>
            <div className="text-[10px] text-cave-200 mt-1">
              {lang === 'ja' ? 'ブレンド比率・価格をWeb検索しています' : '블렌딩 비율·가격을 검색 중입니다'}
            </div>
          </div>
        ) : (
          <div>
            <div className="text-3xl">📷</div>
            <div className="text-sm mt-2">{t.recommend.upload}</div>
          </div>
        )}
      </button>

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

          {/* Wine Info */}
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

          {/* Blend Ratio */}
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

          {/* Price */}
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

          {/* Match Score */}
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

          {/* Description */}
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

      {/* Usage this month */}
      <div className="mt-6 text-center text-[10px] text-cave-200">
        {lang === 'ja' ? `今月の利用回数: ${usageThisMonth}回` : `이번 달 사용 횟수: ${usageThisMonth}회`}
      </div>
    </div>
  )
}
