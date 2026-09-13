'use client'
import { useState, useRef } from 'react'
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

  const analyzeWine = async (file: File) => {
    setAnalyzing(true)
    setResult(null)
    try {
      // Get user's tasting history for preference analysis
      const { data: history } = await supabase
        .from('tastings')
        .select('wine_name, producer, country, grape_variety, score, body, tannin, acidity, aromas, notes')
        .eq('user_id', user.id)
        .not('score', 'is', null)
        .order('score', { ascending: false })
        .limit(20)

      // Read image
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1]
        const prefsText = history && history.length > 0
          ? `User's tasting history (${history.length} wines): ${JSON.stringify(history.slice(0, 10))}`
          : 'No tasting history yet'

        const prompt = lang === 'ja'
          ? `このワインのラベルを分析してください。また、ユーザーの好みデータも参考にして相性スコアを出してください。

${prefsText}

以下のJSON形式のみで回答してください（他のテキストは不要）:
{
  "wineName": "ワイン名",
  "producer": "生産者",
  "vintage": "ヴィンテージ年",
  "region": "産地",
  "country": "国",
  "grapeVariety": "品種",
  "wineType": "タイプ",
  "description": "このワインの特徴（2〜3文）",
  "characteristics": ["特徴1", "特徴2", "特徴3"],
  "matchScore": 75,
  "matchReason": "相性スコアの理由（2文）",
  "recommendedFor": "おすすめシーン",
  "estimatedPrice": "予想価格帯",
  "expertScore": "予想専門家スコア（例: WS90点）"
}`
          : `이 와인 라벨을 분석해주세요. 사용자의 취향 데이터도 참고해서 취향 일치도를 계산해주세요.

${prefsText}

아래 JSON 형식으로만 답하세요:
{
  "wineName": "와인 이름",
  "producer": "생산자",
  "vintage": "빈티지",
  "region": "산지",
  "country": "나라",
  "grapeVariety": "품종",
  "wineType": "타입",
  "description": "이 와인의 특징 (2~3문장)",
  "characteristics": ["특징1", "특징2", "특징3"],
  "matchScore": 75,
  "matchReason": "일치도 이유 (2문장)",
  "recommendedFor": "추천 상황",
  "estimatedPrice": "예상 가격대",
  "expertScore": "예상 전문가 점수 (예: WS90점)"
}`

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type, data: base64 } }] }]
            })
          }
        )
        const data = await res.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const info = JSON.parse(jsonMatch[0])
          setResult(info)
          // Show preview image
          const objUrl = URL.createObjectURL(file)
          setImageUrl(objUrl)
        }
      }
      reader.readAsDataURL(file)
    } catch (e) {
      console.error('Analysis failed:', e)
      alert(t.common.error)
    } finally {
      setAnalyzing(false)
    }
  }

  const matchColor = (score: number) =>
    score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-500'

  const matchBg = (score: number) =>
    score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-400'

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="section-title">{t.recommend.title}</div>
      <div className="text-xs text-gray-400 mb-4">{t.recommend.based}</div>

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
        className="w-full border-2 border-dashed border-wine-200 py-10 text-center text-gray-400 hover:border-wine-400 transition-colors mb-4"
      >
        {analyzing ? (
          <div>
            <div className="text-3xl animate-pulse">🤖</div>
            <div className="text-sm mt-2">{t.tasting.analyzing}</div>
            <div className="text-xs text-wine-400 mt-1">
              {lang === 'ja' ? 'あなたの好みと照合中...' : '취향 분석 중...'}
            </div>
          </div>
        ) : (
          <div>
            <div className="text-3xl">📷</div>
            <div className="text-sm mt-2">{t.recommend.upload}</div>
            <div className="text-xs text-wine-400 mt-1">
              {lang === 'ja' ? 'ラベルを撮影 or アップロード' : '라벨 촬영 또는 업로드'}
            </div>
          </div>
        )}
      </button>

      {result && (
        <div className="space-y-3">
          {imageUrl && (
            <img src={imageUrl} alt="" className="w-full max-h-48 object-contain bg-gray-50" />
          )}

          {/* Wine Info */}
          <div className="card p-4">
            <div className="font-serif text-xl text-wine-800">{result.wineName}</div>
            {result.producer && <div className="text-sm text-gray-500">{result.producer}</div>}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[result.vintage, result.region, result.country, result.grapeVariety].filter(Boolean).map(d => (
                <span key={d} className="text-xs bg-gray-100 px-2 py-0.5 text-gray-600">{d}</span>
              ))}
            </div>
            {result.estimatedPrice && (
              <div className="mt-2 text-xs text-wine-600">{lang === 'ja' ? '参考価格: ' : '참고 가격: '}{result.estimatedPrice}</div>
            )}
            {result.expertScore && (
              <div className="text-xs text-gray-500">{lang === 'ja' ? '専門家評価: ' : '전문가 점수: '}{result.expertScore}</div>
            )}
          </div>

          {/* Match Score */}
          <div className="card p-4">
            <div className="text-xs font-medium text-gray-700 mb-3">{t.recommend.match}</div>
            <div className="flex items-center gap-4">
              <div className={`font-serif text-5xl font-bold ${matchColor(result.matchScore)}`}>
                {result.matchScore}
              </div>
              <div className="flex-1">
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${matchBg(result.matchScore)}`}
                    style={{ width: `${result.matchScore}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-2">{result.matchReason}</div>
              </div>
            </div>
          </div>

          {/* Description */}
          {result.description && (
            <div className="card p-4">
              <div className="text-xs font-medium text-gray-700 mb-2">
                {lang === 'ja' ? 'ワインの特徴' : '와인 특징'}
              </div>
              <div className="text-sm text-gray-600 leading-relaxed">{result.description}</div>
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
                <div className="text-[10px] text-gray-400">{lang === 'ja' ? 'おすすめシーン' : '추천 상황'}</div>
                <div className="text-sm text-gray-700">{result.recommendedFor}</div>
              </div>
            </div>
          )}

          <button onClick={() => fileRef.current?.click()} className="btn-secondary w-full">
            {lang === 'ja' ? '別のワインを解析' : '다른 와인 분석'}
          </button>
        </div>
      )}
    </div>
  )
}
