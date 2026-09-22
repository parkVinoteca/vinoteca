'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { translations, Language } from '@/i18n'
import { analyzeImage, analyzeSommelier } from '@/lib/aiClient'
import AnalysisProgress, { type AnalysisStage } from './AnalysisProgress'
import SommelierNote from './SommelierNote'
import SommelierDetails from './SommelierDetails'
import { sommelierText } from '@/i18n/sommelier'
import ImageCropModal from './ImageCropModal'
import { personalRating } from '@/lib/ratings'
import { TASTE_PROFILE_MIN_RECORDS } from '@/lib/productConfig'
import type { User } from '@supabase/supabase-js'

interface Props { lang: Language; user: User; onBack: () => void }

export default function AIRecommend({ lang, user, onBack }: Props) {
  const t = translations[lang]
  const st = sommelierText[lang]
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
  const [recordCount,setRecordCount] = useState<number|null>(null)
  const [hints,setHints] = useState({wineName:'',producer:'',vintage:''})
  const [usageThisMonth, setUsageThisMonth] = useState(0)
  const [usageLimit, setUsageLimit] = useState(5)
  const [cropFile, setCropFile] = useState<File | null>(null)

  useEffect(() => { loadStats().catch(() => setError(t.common.error)) }, [user.id])

  const loadStats = async () => {
    const { data: tastings, error: tastingsError } = await supabase
      .from('tastings')
      .select('wine_type,stars,score')
      .eq('user_id', user.id)
      .or('score.not.is.null,stars.not.is.null')

    if(tastingsError) throw new Error(t.common.error)
    setRecordCount((tastings || []).filter(t=>personalRating(t)!==null).length)

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
    setUsageLimit(limits?.sommelier_monthly_limit || 20)
  }

  const analyzeWine = async (cropped?: { base64: string; mediaType: string }) => {
    analysisRequest.current?.abort()
    const controller = new AbortController()
    analysisRequest.current = controller
    setImageUrl(cropped ? `data:${cropped.mediaType};base64,${cropped.base64}` : '')
    setAnalysisStage('analyze'); setAnalyzing(true); setResult(null); setError('')
    try {
      const aiResult = cropped ? await analyzeImage('sommelier',cropped,lang,controller.signal) : await analyzeSommelier(hints,lang,controller.signal)
      if(controller.signal.aborted) return
      setAnalysisStage('organize')
      setResult(aiResult)
      setHints(aiResult.identificationHints || {wineName:aiResult.wineName || '',producer:aiResult.producer || '',vintage:aiResult.vintage || ''})
    } catch(e) {
      if(!controller.signal.aborted) setError(e instanceof Error ? e.message : t.common.error)
    } finally {
      if(analysisRequest.current===controller) setAnalyzing(false)
      loadStats().catch(()=>{})
    }
  }

  const handleCropConfirm = (cropped: { base64: string; mediaType: string }) => {
    setCropFile(null)
    analyzeWine(cropped)
  }

  const matchColor = (score: number) =>
    score >= 80 ? 'text-green-700' : score >= 60 ? 'text-yellow-700' : 'text-red-700'
  const matchBg = (score: number) =>
    score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-400'
  const countryFlag = (country: string | null | undefined) => {
    const normalized = (country || '').toLowerCase()
    const flags: Record<string, string> = { france: '🇫🇷', フランス: '🇫🇷', 프랑스: '🇫🇷', italy: '🇮🇹', イタリア: '🇮🇹', 이탈리아: '🇮🇹', spain: '🇪🇸', スペイン: '🇪🇸', 스페인: '🇪🇸', japan: '🇯🇵', 日本: '🇯🇵', 일본: '🇯🇵', usa: '🇺🇸', 'united states': '🇺🇸', アメリカ: '🇺🇸', 미국: '🇺🇸', australia: '🇦🇺', オーストラリア: '🇦🇺', 호주: '🇦🇺', germany: '🇩🇪', ドイツ: '🇩🇪', 독일: '🇩🇪' }
    return flags[normalized] || ''
  }

  const unlocked = recordCount !== null && recordCount >= TASTE_PROFILE_MIN_RECORDS
  const unavailable = analyzing || !unlocked || usageThisMonth >= usageLimit

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="section-title">{st.title}</div>
      <div className="text-sm text-gold-800 mb-1">{st.subtitle}</div>
      <div className="text-xs text-cave-200 mb-4">💡 {st.knowledge}</div>

      {!unlocked && <div className="card p-4 mb-4 text-sm leading-7 text-ink"><p>{recordCount===null ? st.checking : st.gate}</p>{recordCount!==null && <p>{st.progress}: {recordCount}/{TASTE_PROFILE_MIN_RECORDS}</p>}</div>}

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
        <button onClick={() => fileRef.current?.click()} disabled={unavailable}
          className="border-2 border-dashed border-gold-900/40 py-8 text-center text-cave-100 hover:border-gold-500/50 transition-colors rounded-lg disabled:opacity-50">
          <div className="text-2xl mb-1">📷</div>
          <div className="text-xs">{lang === 'ja' ? '撮影' : '촬영'}</div>
        </button>
        <button onClick={() => uploadRef.current?.click()} disabled={unavailable}
          className="border-2 border-dashed border-gold-900/40 py-8 text-center text-cave-100 hover:border-gold-500/50 transition-colors rounded-lg disabled:opacity-50">
          <div className="text-2xl mb-1">🖼️</div>
          <div className="text-xs">{lang === 'ja' ? 'アップロード' : '업로드'}</div>
        </button>
      </div>

      <details className="card p-4 mb-4" open={!!result?.clarification}>
        <summary className="cursor-pointer font-medium text-ink">{st.manual}</summary>
        <form className="mt-3 space-y-3" onSubmit={e=>{e.preventDefault();void analyzeWine()}}>
          <p className="text-xs leading-6 text-cave-100">{result?.clarification || st.hint}</p>
          {(['wineName','vintage','producer'] as const).map(key=><label key={key} className="block text-sm text-ink">{key==='wineName'?st.name:st[key]}<input className="input-field mt-1 w-full" value={hints[key]} required={key==='wineName'} maxLength={key==='vintage'?4:200} pattern={key==='vintage'?'[0-9]{4}|[Nn][Vv]':undefined} disabled={analyzing} onChange={e=>setHints({...hints,[key]:e.target.value})}/></label>)}
          <p className="text-xs text-cave-100">{st.quotaHint}</p>
          <button type="submit" disabled={unavailable} className="btn-primary w-full disabled:opacity-50">{st.submit}</button>
        </form>
      </details>

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
            <div className="font-serif italic text-xl text-gold-800">{result.wineName}</div>
            <dl className="mt-3 divide-y divide-cave-400/50 text-sm">
              {[[lang === 'ja' ? 'ヴィンテージ' : '빈티지', result.vintage], [lang === 'ja' ? '生産者' : '생산자', result.producer], [lang === 'ja' ? 'タイプ' : '유형', t.wineType[result.wineType as keyof typeof t.wineType] || result.wineType], [lang === 'ja' ? '生産地' : '생산지', [countryFlag(result.country), result.country, result.region].filter(Boolean).join(' ')], [lang === 'ja' ? '品種' : '품종', result.grapeVariety || st.unconfirmed], [st.abv, result.alcoholPercent || st.unconfirmed], [st.price, result.priceJPY || st.unconfirmed]].filter(([, value]) => value).map(([label, value]) => (
                <div key={String(label)} className="grid grid-cols-[88px_1fr] gap-3 py-2"><dt className="text-cave-100">{label}</dt><dd className="font-medium text-ink">{value}</dd></div>
              ))}
            </dl>
            {result.wineResearch?.background && <p className="mt-3 text-sm leading-7 text-ink">{result.wineResearch.background}</p>}
            {result.clarification && <p className="mt-3 text-sm leading-6 text-gold-700">{result.clarification}</p>}
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

          <p className="text-xs text-cave-100 leading-6">{st.knowledge}</p>
          {result.sources?.length > 0 && <div className="card p-3 text-xs"><div>{lang === 'ja' ? '調査出典' : '조사 출처'}</div>{result.sources.map((source: { url: string; title: string }, i: number) => <a key={`${source.url}-${i}`} href={source.url} target="_blank" rel="noopener noreferrer" className="block underline mt-2 break-words">{source.title || source.url}</a>)}</div>}
          {(result.priceJPY || result.priceUSD) && (
            <div className="card p-4">
              <div className="text-xs tracking-wider uppercase text-gold-700 mb-2">
                {lang === 'ja' ? '参考価格' : '참고 가격'}
              </div>
              {result.priceJPY && (
                <div className="mb-1">
                  <span className="text-lg font-serif text-gold-800">{result.priceJPY}</span>
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


          <SommelierNote lang={lang} result={result} />
          <SommelierDetails lang={lang} result={result} />
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

          <button onClick={() => uploadRef.current?.click()} disabled={unavailable} className="btn-secondary w-full disabled:opacity-50">
            {lang === 'ja' ? '別のワインを解析' : '다른 와인 분석'}
          </button>
        </div>
      )}

      {usageThisMonth >= usageLimit && <div className="mt-5 rounded-lg border border-gold-500 bg-gold-50 p-3 text-sm text-gold-800">{lang === 'ja' ? '今月の利用上限に達しました。プラン変更機能は決済連携時に提供予定です。' : '이번 달 이용 한도에 도달했습니다. 플랜 변경 기능은 결제 연동 단계에서 제공할 예정입니다.'}</div>}
    </div>
  )
}
