'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { analyzeImage } from '@/lib/aiClient'
import AnalysisProgress, { type AnalysisStage } from './AnalysisProgress'
import type { GrapeResearch } from '@/lib/server/grapes'
import type { WineResearch } from '@/lib/server/wineIdentity'
import AppIcon from './AppIcon'
import SimpleRange from './SimpleRange'
import PersonalRating from './PersonalRating'
import CriticScores from './CriticScores'
import { type CriticScore, readableCriticScores } from '@/lib/criticScores'
import ImageCropModal from './ImageCropModal'
import { translations, Language } from '@/i18n'
import type { User } from '@supabase/supabase-js'

interface Props {
  lang: Language
  user: User
  onBack: () => void
  blindSessionId?: string
  blindWineNumber?: number
  onSaved?: () => void
}

  const ScaleRow = ({ label, hint, options, value, onChange }: any) => (
    <div className="mb-4">
      <div className="text-xs font-medium text-ink mb-0.5">{label}</div>
      {hint && <div className="text-xs text-cave-100 mb-1">{hint}</div>}
      <div className="flex border border-cave-400/30 overflow-hidden">
        {options.map((opt: string) => (
          <button
            key={opt}
            aria-pressed={value === opt}
            onClick={() => onChange(value === opt ? '' : opt)}
            className={`scale-btn ${value === opt ? 'scale-btn-on' : ''}`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )

  const ChipGroup = ({ options, selected, onToggle, single }: any) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt: string) => (
        <button
          key={opt}
          aria-pressed={single ? selected === opt : selected.includes(opt)}
          onClick={() => single
            ? (selected === opt ? onToggle('') : onToggle(opt))
            : onToggle(opt)
          }
          className={`chip ${(single ? selected === opt : selected.includes(opt)) ? 'chip-on' : ''}`}
        >
          {opt}
        </button>
      ))}
    </div>
  )

  const BlicDots = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
    <div className="flex gap-1.5 mt-1">
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          aria-label={`${n} / 5`}
          aria-pressed={n === value}
          onClick={() => onChange(value === n ? 0 : n)}
          className={`w-11 h-11 rounded-full border transition-colors ${
            n <= value ? 'bg-gradient-to-b from-gold-500 to-gold-600 border-gold-600' : 'border-gray-300 bg-cave-600/40'
          }`}
        />
      ))}
    </div>
  )



export default function TastingSheet({ lang, user, onBack, blindSessionId, blindWineNumber, onSaved }: Props) {
  const t = translations[lang]
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)

  // State
  const [message, setMessage] = useState('')
  const [cropFile, setCropFile] = useState<File | null>(null)
  const saveLock = useRef(false)
  const [labelPath, setLabelPath] = useState('')
  const [labelImageUrl, setLabelImageUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage>('upload')
  const analysisRequest = useRef<AbortController | null>(null)
  const [grapeResearch, setGrapeResearch] = useState<GrapeResearch | null>(null)
  const [wineResearch, setWineResearch] = useState<WineResearch | null>(null)
  const [grapeEdited, setGrapeEdited] = useState(false)
  useEffect(() => () => analysisRequest.current?.abort(), [])
  const cancelAnalysis = () => { analysisRequest.current?.abort(); setAnalyzing(false); setMessage(t.analysis.cancelled) }
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [entryMode, setEntryMode] = useState<'simple' | 'expert'>(blindSessionId ? 'expert' : 'simple')
  const [useLabelAI, setUseLabelAI] = useState(true)
  const [monthlyUsage, setMonthlyUsage] = useState(0)
  const [monthlyLimit, setMonthlyLimit] = useState<number | null>(null)

  // Wine Info
  const [wineName, setWineName] = useState('')
  const [producer, setProducer] = useState('')
  const [vintage, setVintage] = useState('')
  const [region, setRegion] = useState('')
  const [country, setCountry] = useState('')
  const [grapeVariety, setGrapeVariety] = useState('')
  const [wineType, setWineType] = useState('')
  const [criticScores, setCriticScores] = useState<CriticScore[]>([])
  const [researchedIdentity, setResearchedIdentity] = useState('')
  const [researchedFacts, setResearchedFacts] = useState('')
  const identity = JSON.stringify([wineName, producer, vintage])
  const verifiedScores = identity === researchedIdentity ? criticScores : []

  // Appearance
  const [colorHue, setColorHue] = useState('')
  const [colorDepth, setColorDepth] = useState('')
  const [clarity, setClarity] = useState('')
  const [viscosity, setViscosity] = useState('')

  // Nose
  const [noseIntensity, setNoseIntensity] = useState('')
  const [noseDevelopment, setNoseDevelopment] = useState('')
  const [customAroma, setCustomAroma] = useState('')
  const [aromas, setAromas] = useState<string[]>([])

  // Palate
  const [sweetness, setSweetness] = useState('')
  const [acidity, setAcidity] = useState('')
  const [tannin, setTannin] = useState('')
  const [tanninTexture, setTanninTexture] = useState('')
  const [mousse, setMousse] = useState('')
  const [alcohol, setAlcohol] = useState('')
  const [body, setBody] = useState('')
  const [flavorIntensity, setFlavorIntensity] = useState('')
  const [finish, setFinish] = useState('')
  const [palateNotes, setPalateNotes] = useState('')

  // Conclusions
  const [blicB, setBlicB] = useState(0)
  const [blicL, setBlicL] = useState(0)
  const [blicI, setBlicI] = useState(0)
  const [blicC, setBlicC] = useState(0)
  const [quality, setQuality] = useState('')
  const [stars, setStars] = useState(0)
  const [notes, setNotes] = useState('')

  // Blind deduction
  const [deductionType, setDeductionType] = useState('')
  const [deductionClimate, setDeductionClimate] = useState('')
  const [deductionGrape, setDeductionGrape] = useState('')
  const [deductionRegion, setDeductionRegion] = useState('')
  const [deductionVintageRange, setDeductionVintageRange] = useState('')
  const [deductionPriceRange, setDeductionPriceRange] = useState('')
  const [deductionNotes, setDeductionNotes] = useState('')
  const [answerRevealed, setAnswerRevealed] = useState(false)
  const [answerWineType, setAnswerWineType] = useState('')
  const factsUnchanged = JSON.stringify([wineName, producer, vintage, region, country, grapeVariety, blindSessionId ? answerWineType : wineType]) === researchedFacts

  // Translate unsaved categorical selections by dictionary position when UI language changes.
  const previousLanguage = useRef(lang)
  useEffect(() => {
    const before = translations[previousLanguage.current]
    previousLanguage.current = lang
    if (before === t) return
    const remap = (value: string, from: string[], to: string[]) => { const index = from.indexOf(value); return index >= 0 ? to[index] ?? value : value }
    const pairs: [React.Dispatch<React.SetStateAction<string>>, string[], string[]][] = [
      [setColorDepth,before.appearance.depthLevels,t.appearance.depthLevels],
      [setClarity,before.appearance.clarityLevels,t.appearance.clarityLevels],
      [setViscosity,before.appearance.viscosityLevels,t.appearance.viscosityLevels],
      [setNoseIntensity,before.nose.intensityLevels,t.nose.intensityLevels],
      [setNoseDevelopment,before.nose.developmentLevels,t.nose.developmentLevels],
      [setSweetness,before.palate.sweetnessLevels,t.palate.sweetnessLevels],
      [setAcidity,before.palate.acidityLevels,t.palate.acidityLevels],
      [setTannin,before.palate.tanninLevels,t.palate.tanninLevels],
      [setTanninTexture,before.palate.tanninTextures,t.palate.tanninTextures],
      [setAlcohol,before.palate.alcoholLevels,t.palate.alcoholLevels],
      [setBody,before.palate.bodyLevels,t.palate.bodyLevels],
      [setFlavorIntensity,before.palate.intensityLevels,t.palate.intensityLevels],
      [setFinish,before.palate.finishLevels,t.palate.finishLevels],
      [setQuality,before.conclusions.qualityLevels,t.conclusions.qualityLevels],
    ]
    pairs.forEach(([set,from,to]) => set(value => remap(value,from,to)))
    setColorHue(value => remap(value,Object.values(before.appearance.colorHues).flat(),Object.values(t.appearance.colorHues).flat()))
    const aromaKeys = ['primaryAromas','secondaryAromas','tertiaryAromas'] as const
    setAromas(values => values.map(value => remap(value,aromaKeys.flatMap(key => before.nose[key]),aromaKeys.flatMap(key => t.nose[key]))))
    setMousse(value => remap(value,lang === 'ko' ? ['繊細','クリーミー','荒い'] : ['섬세함','크리미함','거침'],lang === 'ko' ? ['섬세함','크리미함','거침'] : ['繊細','クリーミー','荒い']))
  }, [lang,t])

  const isBlind = !!blindSessionId

  useEffect(() => {
    if (isBlind) return setEntryMode('expert')
    const savedMode = localStorage.getItem('vinoteca:tasting-mode')
    if (savedMode === 'simple' || savedMode === 'expert') setEntryMode(savedMode)
  }, [isBlind])

  useEffect(() => {
    const loadUsage = async () => {
      const tokyoMonth = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 7)
      const start = new Date(`${tokyoMonth}-01T00:00:00+09:00`).toISOString()
      const [{ count }, { data: profile }] = await Promise.all([
        supabase.from('ai_usage_logs').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('feature', 'label_scan').gte('created_at', start),
        supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle(),
      ])
      const plan = profile?.plan || 'free'
      const { data: limits } = await supabase.from('subscription_limits').select('label_monthly_limit').eq('plan', plan).maybeSingle()
      setMonthlyUsage(count || 0)
      setMonthlyLimit(limits?.label_monthly_limit ?? null)
    }
    loadUsage().catch(() => {})
  }, [user.id])

  const labelAIAvailable = monthlyLimit !== null && monthlyUsage < monthlyLimit
  const labelAIEnabled = (!isBlind || answerRevealed) && useLabelAI && labelAIAvailable

  const changeEntryMode = (mode: 'simple' | 'expert') => {
    setEntryMode(mode)
    localStorage.setItem('vinoteca:tasting-mode', mode)
  }

  const selectWineType = (next: string, toggle = true) => {
    const value = toggle && wineType === next ? '' : next
    setWineType(value)
    const allowed = value ? t.appearance.colorHues[value as keyof typeof t.appearance.colorHues] : []
    if (colorHue && !allowed.includes(colorHue)) setColorHue('')
    if (value !== 'red') { setTannin(''); setTanninTexture('') }
    if (value !== 'sparkling') setMousse('')
  }

  const handlePhotoUpload = async (file: File) => {
    if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) {
      setMessage(lang === 'ja' ? '20MB以下の画像を選択してください。' : '20MB 이하 이미지를 선택해주세요.'); return
    }
    setCropFile(file)
  }
  const savePhoto = async (image: { base64: string; mediaType: string }) => {
    analysisRequest.current?.abort()
    const controller = new AbortController()
    analysisRequest.current = controller
    setCropFile(null)
    setAnalysisStage('upload')
    setLabelPath('')
    setLabelImageUrl(`data:${image.mediaType};base64,${image.base64}`)
    setCriticScores([])
    setResearchedIdentity('')
    setResearchedFacts('')
    setGrapeResearch(null)
    setWineResearch(null)
    setGrapeEdited(false)
    if (labelAIEnabled) {
      // A failed replacement scan must not leave the previous bottle's facts
      // attached to the newly uploaded photograph.
      setWineName(''); setProducer(''); setVintage(''); setRegion(''); setCountry(''); setGrapeVariety('')
      if (!isBlind) setWineType('')
      setAnswerWineType(''); setCriticScores([]); setResearchedIdentity(''); setResearchedFacts('')
    }
    setAnalyzing(true)
    setMessage('')
    try {
      // Canvas output strips metadata and uploads only the selected label region.
      const bytes = Uint8Array.from(atob(image.base64), c => c.charCodeAt(0))
      const fileName = `${user.id}/${crypto.randomUUID()}.jpg`
      const { error } = await supabase.storage.from('label-images').upload(fileName, new Blob([bytes], { type: image.mediaType }), { contentType: image.mediaType })
      if (controller.signal.aborted) return
      if (error) throw new Error(lang === 'ja' ? '写真を保存できませんでした。再度お試しください。' : '사진을 저장하지 못했습니다. 다시 시도해주세요.')
      setLabelPath(fileName)
      setLabelImageUrl(`data:${image.mediaType};base64,${image.base64}`)
      if (labelAIEnabled) {
        setMonthlyUsage(n => n + 1)
        setAnalysisStage('analyze')
        const info = await analyzeImage('label', image, lang, controller.signal)
        if (controller.signal.aborted) return
        setAnalysisStage('organize')
        setGrapeResearch(info.grapeResearch || null)
        setWineResearch(info.wineResearch || null)
        setWineName(info.wineName || '')
        setProducer(info.producer || '')
        setVintage(info.vintage && /^\d{4}$/.test(info.vintage) ? info.vintage : '')
        setRegion(info.region || '')
        setCountry(info.country || '')
        setGrapeVariety(info.grapeVariety || '')
        if (isBlind) setAnswerWineType(info.wineType || '')
        else selectWineType(info.wineType || '', false)
        setCriticScores(readableCriticScores(info.criticScores))
        setResearchedIdentity(JSON.stringify([info.wineName || '', info.producer || '', info.vintage && /^\d{4}$/.test(info.vintage) ? info.vintage : '']))
        setResearchedFacts(JSON.stringify([info.wineName || '', info.producer || '', info.vintage && /^\d{4}$/.test(info.vintage) ? info.vintage : '', info.region || '', info.country || '', info.grapeVariety || '', info.wineType || '']))
      }
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : t.common.error)
    } finally { if (analysisRequest.current === controller) setAnalyzing(false) }
  }

  const toggleAroma = (aroma: string) => {
    setAromas(prev => prev.includes(aroma) ? prev.filter(a => a !== aroma) : [...prev, aroma])
  }


  const handleSave = async () => {
    if (saveLock.current || analyzing) return
    saveLock.current = true
    setSaving(true)
    setMessage('')
    try {
      const { error } = await supabase.from('tastings').insert({
        user_id: user.id,
        mode: isBlind ? 'blind' : 'normal',
        blind_session_id: blindSessionId || null,
        blind_wine_number: blindWineNumber || null,
        wine_name: wineName || null,
        producer: producer || null,
        vintage: vintage ? parseInt(vintage) : null,
        region: region || null,
        country: country || null,
        grape_variety: grapeVariety || null,
        wine_type: ((isBlind && answerWineType) || wineType || null) as 'red' | 'white' | 'rose' | 'sparkling' | 'sweet' | null,
        label_image_url: labelPath || null,
        color_hue: colorHue || null,
        color_depth: colorDepth || null,
        clarity: clarity || null,
        viscosity: viscosity || null,
        nose_intensity: noseIntensity || null,
        nose_development: noseDevelopment || null,
        nose_condition: null,
        aromas: [...aromas, customAroma.trim()].filter(Boolean).length ? [...new Set([...aromas, customAroma.trim()].filter(Boolean))] : null,
        sweetness: sweetness || null,
        acidity: acidity || null,
        tannin: tannin || null,
        tannin_texture: tanninTexture || null,
        mousse: mousse || null,
        alcohol: alcohol || null,
        body: body || null,
        flavor_intensity: flavorIntensity || null,
        finish: finish || null,
        blic_balance: blicB || null,
        blic_length: blicL || null,
        blic_intensity: blicI || null,
        blic_complexity: blicC || null,
        quality: quality || null,
        deduction_type: isBlind ? deductionType || null : null,
        deduction_climate: isBlind ? deductionClimate || null : null,
        deduction_grape: isBlind ? deductionGrape || null : null,
        deduction_region: isBlind ? deductionRegion || null : null,
        deduction_vintage_range: isBlind ? deductionVintageRange || null : null,
        deduction_price_range: isBlind ? deductionPriceRange || null : null,
        deduction_notes: isBlind ? deductionNotes || null : null,
        answer_producer: isBlind ? producer || null : null,
        answer_wine: isBlind ? wineName || null : null,
        score: null,
        stars: stars || null,
        palate_notes: palateNotes || null,
        notes: notes || null,
        critic_scores: verifiedScores,
        language: lang,
      })
      if (error) throw error
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        if (onSaved) onSaved(); else onBack()
      }, 1500)
    } catch (e) {
      const quotaReached = typeof e === 'object' && e !== null && 'message' in e && String(e.message).includes('tasting_limit')
      setMessage(quotaReached
        ? (lang === 'ja' ? '今月のテイスティング作成上限に達しました。' : '이번 달 테이스팅 작성 한도에 도달했습니다.')
        : t.common.error)
    } finally {
      setSaving(false)
      saveLock.current = false
    }
  }

  const hueHex: Record<string, string> = {
    'ブラウン':'#80512D','브라운':'#80512D','サーモン':'#FA9C8B','살몬':'#FA9C8B',
    'レモングリーン':'#DDE26A','레몬 그린':'#DDE26A','レモン':'#F0E68C','레몬':'#F0E68C','ゴールド':'#D4A017','골드':'#D4A017','琥珀':'#B8860B','앰버':'#B8860B',
    'ピンク':'#F4A6B0','핑크':'#F4A6B0','ピンクオレンジ':'#F5A97F','핑크 오렌지':'#F5A97F','オレンジ':'#E8894A','오렌지':'#E8894A','オニオンスキン':'#D99A7C','어니언 스킨':'#D99A7C',
    'パープル':'#5B0E3C','퍼플':'#5B0E3C','ルビー':'#9B111E','루비':'#9B111E','ガーネット':'#7B2331','가넷':'#7B2331','トーニー':'#A0522D','토니':'#A0522D',
  }
  const colorOptions = (wineType ? t.appearance.colorHues[wineType as keyof typeof t.appearance.colorHues] : []) || []
  const DepthSelector = ({ simple = false }: { simple?: boolean }) => {
    const labels = simple
      ? t.tastingGuide.depth
      : t.appearance.depthLevels
    const base = hueHex[colorHue] || '#9B111E'
    const opacity = [0.3, 0.65, 1]
    return <div className="mb-5"><div className="text-sm font-medium text-ink mb-2">{simple ? (lang === 'ja' ? '色の濃さ' : '색의 진하기') : t.tasting.colorDepth}</div>
      <div className="grid grid-cols-3 gap-1.5">{labels.map((label, index) => <button key={label} onClick={() => setColorDepth(t.appearance.depthLevels[index])} aria-pressed={colorDepth === t.appearance.depthLevels[index]} className={`min-h-20 rounded-lg border px-1 py-2 text-xs ${colorDepth === t.appearance.depthLevels[index] ? 'border-gold-500 ring-2 ring-gold-200' : 'border-cave-400'}`}>
        <span className="mx-auto mb-2 block h-8 w-8 rounded-full border border-black/10" style={{ backgroundColor: `${base}${Math.round(opacity[index] * 255).toString(16).padStart(2,'0')}` }} />{label}
      </button>)}</div></div>
  }

  const labelEditor = <div className="space-y-5">
        <div className={`rounded-lg border px-3 py-2 text-sm ${monthlyLimit !== null && monthlyUsage >= monthlyLimit - 2 ? 'border-gold-500 bg-gold-50 text-gold-800' : 'border-cave-400 bg-white text-cave-50'}`}>
          {lang === 'ja' ? '今月のテイスティングAI' : '이번 달 테이스팅 AI'}: {monthlyUsage} / {monthlyLimit ?? '—'}
          <p className="mt-1 text-xs">{lang === 'ja' ? '写真の保存・手入力はいつでも使えます。AI利用枠がない場合はワイン情報を入力してください。' : '사진 저장·직접 입력은 언제든 가능합니다. AI 사용 가능 횟수가 없으면 와인 정보를 직접 입력해주세요.'}</p>
        </div>

        {<div className="rounded-xl border border-cave-400 bg-white p-3">
          <button type="button" role="switch" aria-checked={labelAIEnabled} aria-describedby="label-ai-help"
            disabled={analyzing || !labelAIAvailable} onClick={() => setUseLabelAI(value => !value)}
            className="flex min-h-11 w-full items-center justify-between gap-3 text-left disabled:opacity-60">
            <span className="text-sm font-medium">{t.labelAI.title}</span>
            <span aria-hidden="true" className="flex items-center gap-2 text-xs">
              {labelAIEnabled ? 'ON' : 'OFF'}
              <span className={`relative h-6 w-11 rounded-full transition-colors ${labelAIEnabled ? 'bg-gold-700' : 'bg-gray-300'}`}>
                <span className={`absolute left-0 top-1 h-4 w-4 rounded-full bg-white transition-transform ${labelAIEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </span>
            </span>
          </button>
          <p id="label-ai-help" className="mt-1 text-xs leading-relaxed text-cave-100">{monthlyLimit === null ? t.labelAI.loading : !labelAIAvailable ? t.labelAI.unavailable : labelAIEnabled ? t.labelAI.on : t.labelAI.off}</p>
        </div>}

        {/* Label Photo */}
        <div>
          <div className="section-title">{t.tasting.labelPhoto}</div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) handlePhotoUpload(file) }}
          />
          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) handlePhotoUpload(file) }}
          />
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <div className="flex h-40 items-center justify-center overflow-hidden rounded-xl border border-cave-400 bg-white">
              {labelImageUrl ? <img src={labelImageUrl} alt={t.tasting.labelPhoto} className="h-full w-full object-contain" /> : <div className="flex flex-col items-center gap-2 text-cave-100"><AppIcon name="wine" className="h-9 w-9"/><span className="text-xs">{t.tasting.labelPhoto}</span></div>}
            </div>
            <div className="grid grid-rows-2 gap-3">
              <button type="button" disabled={analyzing} onClick={() => fileRef.current?.click()} className="btn-secondary flex items-center justify-center gap-2 rounded-xl px-2 text-sm"><AppIcon name="camera"/>{t.tasting.takePhoto}</button>
              <button type="button" disabled={analyzing} onClick={() => uploadRef.current?.click()} className="btn-secondary flex items-center justify-center gap-2 rounded-xl px-2 text-sm"><AppIcon name="upload"/>{lang === 'ja' ? 'アップロード' : '업로드'}</button>
            </div>
          </div>
        </div>

        {/* Shared identity fields for normal tasting and blind reveal. */}
        {(
          <div>
            <div className="section-title">{lang === 'ja' ? 'ワイン情報' : '와인 정보'}</div>
            {wineResearch && <div role="status" className="mb-4 border border-gold-900/20 bg-cave-600/20 p-3 text-xs leading-6 text-cave-100">
              <p>{!factsUnchanged ? t.analysis.identityEdited : wineResearch.status === 'catalog' ? t.analysis.identityCatalog : wineResearch.status === 'knowledge' ? t.analysis.identityKnowledge : wineResearch.status === 'verified' ? t.analysis.identityVerified : t.analysis.identityUnverified}</p>
              {factsUnchanged && wineResearch.brand && <p>{t.analysis.brand}: {wineResearch.brand}</p>}
              {factsUnchanged && wineResearch.background && <p>{t.analysis.background}: {wineResearch.background}</p>}
              {factsUnchanged && wineResearch.source && <a href={wineResearch.source} target="_blank" rel="noopener noreferrer" className="text-gold-700 underline">{t.analysis.identitySource} ↗</a>}
            </div>}
            <div className="space-y-3">
              {[
                { label: t.tasting.wineName, value: wineName, onChange: setWineName },
                { label: t.tasting.vintage, value: vintage, onChange: setVintage, type: 'number' },
                { label: t.tasting.producer, value: producer, onChange: setProducer },
                { label: t.tasting.region, value: region, onChange: setRegion },
                { label: t.tasting.country, value: country, onChange: setCountry },
                { label: t.tasting.grapeVariety, value: grapeVariety, onChange: (value: string) => { setGrapeVariety(value); setGrapeEdited(true) } },
              ].map(field => (
                <div key={field.label} className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3">
                  <label className="pt-3 text-xs tracking-wide text-cave-100">{field.label}</label>
                  <div>
                  <input
                    aria-label={field.label}
                    aria-describedby={field.label === t.tasting.grapeVariety && grapeResearch ? 'grape-research-note' : undefined}
                    type={field.type || 'text'}
                    value={field.value}
                    onChange={e => field.onChange(e.target.value)}
                    className="input-field"
                  />
                  {field.label === t.tasting.grapeVariety && grapeResearch && <div id="grape-research-note" className="mt-2 space-y-1 text-xs leading-6 text-cave-100">
                    {(grapeEdited || identity !== researchedIdentity) && <p>{t.analysis.edited}</p>}
                    {grapeResearch.status === 'not_found' && <p>{t.analysis.notFound}</p>}
                    {grapeResearch.status === 'unavailable' && <p>{t.analysis.unavailable}</p>}
                    {grapeResearch.status === 'label' && <p>{t.analysis.labelOnly}</p>}
                    {grapeResearch.status === 'knowledge' && !grapeEdited && factsUnchanged && <p>{t.analysis.grapeKnowledge}</p>}
                    {grapeResearch.status === 'verified' && !grapeEdited && identity === researchedIdentity && <>
                      {!grapeResearch.vintageMatched && <p>{t.analysis.vintageUnknown}</p>}
                      <p>{grapeResearch.blendRatio ? `${t.analysis.blend}: ${grapeResearch.blendRatio}` : t.analysis.ratioMissing}</p>
                      {grapeResearch.source && <a href={grapeResearch.source} target="_blank" rel="noopener noreferrer" className="text-gold-700 underline">{t.analysis.source} ↗</a>}
                    </>}
                  </div>}
                  </div>
                </div>
              ))}

              <CriticScores value={verifiedScores} lang={lang} />
            </div>
          </div>
        )}


  </div>

  return (
    <div className="max-w-lg mx-auto">
      {analyzing && <AnalysisProgress imageUrl={labelImageUrl} lang={lang} stage={analysisStage} mode={analysisStage === 'upload' ? 'upload' : 'label'} onCancel={cancelAnalysis} />}
      {message && <p role="alert" className="card p-3 mb-3 text-sm">{message}</p>}
      {cropFile && <ImageCropModal file={cropFile} lang={lang} onCancel={() => setCropFile(null)} onConfirm={savePhoto} />}
      {/* Header */}
      <div className="sticky top-14 bg-parchment border-b border-cave-400/30 px-4 py-3 flex items-center justify-between z-40">
        <button onClick={onBack} className="text-gold-700 text-sm">← {t.common.back}</button>
        <div className="text-xs font-medium tracking-widest uppercase text-gold-700">
          {isBlind ? `${t.blind.wine} ${blindWineNumber}` : t.tasting.normal}
        </div>
        <span className="w-16" aria-hidden="true" />
      </div>

      <div className="p-4 pb-28 space-y-6">

        {!isBlind && labelEditor}

              {/* Wine Type */}
              <div>
                <label className="text-xs tracking-wider uppercase text-gold-700 mb-1 block">{lang === 'ja' ? 'タイプ' : '타입'}</label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(t.wineType).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => selectWineType(key)}
                      className={`chip ${wineType === key ? 'chip-on' : ''}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

        {!isBlind && <div className="sticky top-[106px] z-30 rounded-xl border border-cave-400 bg-white p-1 shadow-sm" role="group" aria-label={lang === 'ja' ? '入力モード' : '입력 모드'}>
          <div className="grid grid-cols-2 gap-1">
            <button onClick={() => changeEntryMode('simple')} aria-pressed={entryMode === 'simple'} className={`min-h-11 rounded-lg text-sm font-medium ${entryMode === 'simple' ? 'bg-gold-500 text-white' : 'text-cave-100'}`}>{lang === 'ja' ? 'かんたん入力' : '간단 입력'}</button>
            <button onClick={() => changeEntryMode('expert')} aria-pressed={entryMode === 'expert'} className={`min-h-11 rounded-lg text-sm font-medium ${entryMode === 'expert' ? 'bg-gold-500 text-white' : 'text-cave-100'}`}>{lang === 'ja' ? '専門的' : '전문 입력'}</button>
          </div>
        </div>}

        {entryMode === 'simple' && !isBlind && <div className="card p-4">
          <div className="section-title">{lang === 'ja' ? 'かんたんテイスティング' : '간단 테이스팅'}</div>
          {!wineType && <p className="mb-4 rounded-lg bg-gold-50 p-3 text-sm text-gold-800">{lang === 'ja' ? '先にワインタイプを選ぶと、色と渋みの項目が合った内容になります。' : '먼저 와인 유형을 선택하면 색과 떫은맛 항목이 알맞게 표시됩니다.'}</p>}
          {colorOptions.length > 0 && <div className="mb-5">
            <div className="text-sm font-medium text-ink mb-2">{lang === 'ja' ? 'ワインの色' : '와인 색'}</div>
            <div className="grid grid-cols-4 gap-2">{colorOptions.map(option => <button key={option} onClick={() => setColorHue(option)} aria-pressed={colorHue === option} className={`min-h-20 rounded-lg border p-2 text-xs ${colorHue === option ? 'border-gold-500 ring-2 ring-gold-200' : 'border-cave-400'}`}><span className="mx-auto mb-2 block h-8 w-8 rounded-full border border-black/10" style={{backgroundColor:hueHex[option]}} />{option}</button>)}</div>
          </div>}
          <p className="text-sm text-cave-100 mb-4">{t.tastingGuide.simple}</p>
          <DepthSelector simple />
          <SimpleRange unselected={t.tastingGuide.unselected} label={lang === 'ja' ? '香りの強さ' : '향의 강도'} display={lang === 'ja' ? ['とても控えめ','控えめ','ふつう','しっかり','とても強い'] : ['매우 은은함','은은함','보통','뚜렷함','매우 강함']} stored={t.nose.intensityLevels} value={noseIntensity} onChange={setNoseIntensity} />
          <div className="mb-5"><div className="text-sm font-medium text-ink mb-2">{lang === 'ja' ? 'どんな香り？' : '어떤 향인가요?'}</div><ChipGroup options={wineType ? t.simpleAromas[wineType as keyof typeof t.simpleAromas] || [] : []} selected={aromas} onToggle={toggleAroma} /><p className="text-xs text-cave-100 mt-2">{wineType ? t.tastingGuide.aromas : t.tastingGuide.selectType}</p>{aromas.filter(a => !(t.simpleAromas[wineType as keyof typeof t.simpleAromas] || []).includes(a)).map(a => <button key={a} className="chip chip-on mt-2" onClick={() => toggleAroma(a)}>{a} ×</button>)}</div>
          <label className="block mb-4 text-sm text-ink">{t.aromaInput.label}<textarea className="input-field mt-2 w-full" rows={2} maxLength={500} value={customAroma} onChange={e => setCustomAroma(e.target.value)} placeholder={t.aromaInput.placeholder} /><span className="block mt-1 text-xs text-cave-100">{t.aromaInput.hint}</span></label>
          <SimpleRange unselected={t.tastingGuide.unselected} label={lang === 'ja' ? '甘さ' : '단맛'} display={t.tastingGuide.sweetness.filter((_,i)=>i!==2)} stored={t.palate.sweetnessLevels.filter((_,i)=>i!==2)} value={sweetness} onChange={setSweetness} />
          <SimpleRange unselected={t.tastingGuide.unselected} label={lang === 'ja' ? '酸味' : '산미'} display={lang === 'ja' ? ['弱い','やや弱い','中くらい','やや強い','強い'] : ['매우 약함','약함','보통','강함','매우 강함']} stored={t.palate.acidityLevels} value={acidity} onChange={setAcidity} />
          {wineType === 'red' && <SimpleRange unselected={t.tastingGuide.unselected} label={lang === 'ja' ? '渋み' : '떫은맛'} display={lang === 'ja' ? ['ほとんど無い','少ない','ふつう','しっかり','とても強い'] : ['거의 없음','적음','보통','뚜렷함','매우 강함']} stored={t.palate.tanninLevels} value={tannin} onChange={setTannin} />}
          {wineType === 'sparkling' && <div className="mb-5"><div className="text-sm font-medium text-ink mb-2">{lang === 'ja' ? '泡の感じ' : '거품의 느낌'}</div><ChipGroup options={lang === 'ja' ? ['繊細','クリーミー','荒い'] : ['섬세함','크리미함','거침']} selected={mousse} onToggle={setMousse} single /></div>}
          <SimpleRange unselected={t.tastingGuide.unselected} label={lang === 'ja' ? '飲み口の重さ' : '마실 때의 무게감'} display={lang === 'ja' ? ['とても軽い','軽い','ふつう','重い','とても重い'] : ['매우 가벼움','가벼움','보통','무거움','매우 무거움']} stored={t.palate.bodyLevels} value={body} onChange={setBody} />
          <button onClick={()=>changeEntryMode('expert')} className="mt-5 w-full text-sm text-gold-700 underline underline-offset-4">{lang === 'ja' ? '専門的モードに切り替える' : '전문 입력으로 전환'}</button>
        </div>}

        {entryMode === 'expert' && <>
        {/* ① Appearance */}
        <div>
          <div className="section-title">① {t.tasting.appearance}</div>
          {colorOptions.length ? <div className="mb-4"><div className="text-sm font-medium text-ink mb-2">{t.tasting.colorHue}</div><div className="grid grid-cols-4 gap-2">{colorOptions.map(option=><button key={option} onClick={()=>setColorHue(option)} aria-pressed={colorHue===option} className={`rounded-lg border p-2 text-xs ${colorHue===option?'border-gold-500 ring-2 ring-gold-200':'border-cave-400'}`}><span className="mx-auto mb-1 block h-7 w-7 rounded-full border border-black/10" style={{backgroundColor:hueHex[option]}} />{option}</button>)}</div></div> : <p className="mb-4 text-sm text-cave-100">{lang === 'ja' ? 'ワインタイプを選ぶと色調を選べます。' : '와인 유형을 선택하면 색조를 고를 수 있습니다.'}</p>}
          <DepthSelector />
          <ScaleRow label={t.tasting.clarity} hint={t.tastingGuide.clarity} options={t.appearance.clarityLevels} value={clarity} onChange={setClarity} />
          <ScaleRow label={t.tasting.viscosity} options={t.appearance.viscosityLevels} value={viscosity} onChange={setViscosity} />
        </div>

        <p className="text-sm text-cave-100">{t.tastingGuide.expert}</p>
        {/* ② Nose */}
        <div>
          <div className="section-title">② {t.tasting.nose}</div>
          <ScaleRow label={t.tasting.noseIntensity} options={t.nose.intensityLevels} value={noseIntensity} onChange={setNoseIntensity} />
          <ScaleRow label={t.tastingGuide.development} options={t.nose.developmentLevels} value={noseDevelopment} onChange={setNoseDevelopment} />
          <div className="mb-2">
            <div className="text-xs font-medium text-ink mb-1">
              {lang === 'ja' ? '一次アロマ（果実・花・ハーブ）' : '1차 아로마 (과실·꽃·허브)'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {t.nose.primaryAromas.map(a => (
                <button key={a} onClick={() => toggleAroma(a)} aria-pressed={aromas.includes(a)} className={`chip ${aromas.includes(a) ? 'chip-on' : ''}`}>{a}</button>
              ))}
            </div>
          </div>
          <div className="mb-2">
            <div className="text-xs font-medium text-ink mb-1">
              {lang === 'ja' ? '二次アロマ（醸造・樽）' : '2차 아로마 (양조·오크)'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {t.nose.secondaryAromas.map(a => (
                <button key={a} onClick={() => toggleAroma(a)} className={`chip ${aromas.includes(a) ? 'chip-on' : ''}`}>{a}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-ink mb-1">
              {lang === 'ja' ? '三次アロマ（熟成）' : '3차 아로마 (숙성)'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {t.nose.tertiaryAromas.map(a => (
                <button key={a} onClick={() => toggleAroma(a)} className={`chip ${aromas.includes(a) ? 'chip-on' : ''}`}>{a}</button>
              ))}
            </div>
          </div>
          <label className="block mb-4 text-sm text-ink">{t.aromaInput.label}<textarea className="input-field mt-2 w-full" rows={2} maxLength={500} value={customAroma} onChange={e => setCustomAroma(e.target.value)} placeholder={t.aromaInput.placeholder} /><span className="block mt-1 text-xs text-cave-100">{t.aromaInput.hint}</span></label>
        </div>

        {/* ③ Palate */}
        <div>
          <div className="section-title">③ {t.tasting.palate}</div>
          <ScaleRow label={t.tasting.sweetness} hint={lang === 'ja' ? '口に感じる甘さ' : '입에서 느끼는 단맛'} options={t.palate.sweetnessLevels} value={sweetness} onChange={setSweetness} />
          <ScaleRow label={t.tasting.acidity} hint={lang === 'ja' ? '唾液が多く出れば高い' : '침이 많이 나오면 높음'} options={t.palate.acidityLevels} value={acidity} onChange={setAcidity} />
          {wineType === 'red' && <><ScaleRow label={t.tasting.tannin} hint={lang === 'ja' ? '歯茎の乾燥感' : '잇몸이 마르는 느낌'} options={t.palate.tanninLevels} value={tannin} onChange={setTannin} />
          <div className="mb-4">
            <div className="text-xs font-medium text-ink mb-1">{t.tasting.tanninTexture}</div>
            <ChipGroup options={t.palate.tanninTextures} selected={tanninTexture} onToggle={setTanninTexture} single />
          </div></>}
          {wineType === 'sparkling' && <div className="mb-4"><div className="text-sm font-medium text-ink mb-2">{lang === 'ja' ? 'ムース（泡の質感）' : '무스(거품 질감)'}</div><ChipGroup options={lang === 'ja' ? ['繊細','クリーミー','荒い'] : ['섬세함','크리미함','거침']} selected={mousse} onToggle={setMousse} single /></div>}
          <ScaleRow label={t.tasting.alcohol} hint={lang === 'ja' ? '喉に感じる熱さ' : '목에서 느끼는 열감'} options={t.palate.alcoholLevels} value={alcohol} onChange={setAlcohol} />
          <ScaleRow label={t.tasting.body} hint={lang === 'ja' ? '口の中の重量感' : '입 안의 무게감'} options={t.palate.bodyLevels} value={body} onChange={setBody} />
          <ScaleRow label={t.tasting.flavorIntensity} options={t.palate.intensityLevels} value={flavorIntensity} onChange={setFlavorIntensity} />
          <ScaleRow label={t.tasting.finish} hint={lang === 'ja' ? '飲み込んだ後の持続時間' : '삼킨 후 지속 시간'} options={t.palate.finishLevels} value={finish} onChange={setFinish} />
          <label className="text-xs text-cave-100" htmlFor="palate-notes">{t.tastingGuide.flavors}</label>
          <textarea id="palate-notes"
            value={palateNotes}
            onChange={e => setPalateNotes(e.target.value)}
            placeholder={lang === 'ja' ? '味わいに関するメモ...' : '미각 관련 메모...'}
            className="w-full border border-cave-400/30 p-3 text-sm resize-none h-16 focus:outline-none focus:border-gold-500/40 bg-cave-600/40"
          />
        </div>

        {/* ④ Conclusions */}
        {(entryMode === 'expert' || isBlind) && <div>
          <div className="section-title">④ {t.tasting.conclusions}</div>

          <p className="text-xs text-cave-100 mb-3">{t.tastingGuide.blic}</p>
          {/* BLIC */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {[
              { key: 'B', label: lang === 'ja' ? 'Balance バランス' : 'Balance 균형', val: blicB, set: setBlicB, hint: lang === 'ja' ? '酸・タンニン・果実の調和' : '산·타닌·과실의 조화' },
              { key: 'L', label: lang === 'ja' ? 'Length 余韻' : 'Length 여운', val: blicL, set: setBlicL, hint: lang === 'ja' ? '飲み込んだ後の持続' : '삼킨 후 지속' },
              { key: 'I', label: lang === 'ja' ? 'Intensity 強度' : 'Intensity 강도', val: blicI, set: setBlicI, hint: lang === 'ja' ? '香りと味の集中度' : '향과 맛의 집중도' },
              { key: 'C', label: lang === 'ja' ? 'Complexity 複雑さ' : 'Complexity 복잡도', val: blicC, set: setBlicC, hint: lang === 'ja' ? '層の豊かさ' : '층위의 풍성함' },
            ].map(b => (
              <div key={b.key} className="card p-3">
                <div className="font-serif text-lg text-gold-700">{b.key}</div>
                <div className="text-xs text-cave-50 font-medium">{b.label}</div>
                <div className="text-xs text-cave-100 mb-2">{b.hint}</div>
                <BlicDots value={b.val} onChange={b.set} />
              </div>
            ))}
          </div>

          <ScaleRow label={t.tastingGuide.quality} options={t.conclusions.qualityLevels} value={quality} onChange={setQuality} />
        </div>}
        </>}

        {/* Blind Deduction */}
        {isBlind && (
          <div>
            <div className="section-title bg-cave-700 text-white p-2 -mx-4 px-4 mb-4">
              {t.tasting.deduction}
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-xs font-medium text-ink mb-1">{lang === 'ja' ? '予想タイプ' : '예상 타입'}</div>
                <ChipGroup options={t.conclusions.deductionTypes} selected={deductionType} onToggle={setDeductionType} single />
              </div>
              <div>
                <div className="text-xs font-medium text-ink mb-1">{lang === 'ja' ? '予想気候' : '예상 기후'}</div>
                <ChipGroup options={t.conclusions.climates} selected={deductionClimate} onToggle={setDeductionClimate} single />
              </div>
              <div>
                <div className="text-xs font-medium text-ink mb-1">{lang === 'ja' ? '予想品種' : '예상 품종'}</div>
                <ChipGroup options={t.conclusions.grapes} selected={deductionGrape} onToggle={setDeductionGrape} single />
              </div>
              <div>
                <div className="text-xs font-medium text-ink mb-1">{lang === 'ja' ? '予想産地' : '예상 산지'}</div>
                <ChipGroup options={t.conclusions.regions} selected={deductionRegion} onToggle={setDeductionRegion} single />
              </div>
              <div>
                <div className="text-xs font-medium text-ink mb-1">{lang === 'ja' ? '予想ヴィンテージ' : '예상 빈티지'}</div>
                <ChipGroup options={t.conclusions.vintageRanges} selected={deductionVintageRange} onToggle={setDeductionVintageRange} single />
              </div>
              <div>
                <div className="text-xs font-medium text-ink mb-1">{lang === 'ja' ? '予想価格帯' : '예상 가격대'}</div>
                <ChipGroup options={t.conclusions.priceRanges} selected={deductionPriceRange} onToggle={setDeductionPriceRange} single />
              </div>
              <textarea
                value={deductionNotes}
                onChange={e => setDeductionNotes(e.target.value)}
                placeholder={lang === 'ja' ? '推論の根拠...' : '추론 근거...'}
                className="w-full border border-cave-400/30 p-3 text-sm resize-none h-16 focus:outline-none focus:border-gold-500/40 bg-cave-600/40"
              />


            </div>
          </div>
        )}

        <PersonalRating lang={lang} value={stars} onChange={setStars} />

        {/* Notes */}
        <div>
          <div className="section-title">{t.tasting.notes}</div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={lang === 'ja' ? 'テイスティングノート...' : '테이스팅 노트...'}
            className="w-full border border-cave-400/30 p-3 text-sm resize-none h-24 focus:outline-none focus:border-gold-500/40 bg-cave-600/40 font-serif italic"
          />
        </div>

        {isBlind && <section className="card p-4 space-y-4">
          <h3 className="section-title">{t.blindAnswer.title}</h3>
          <p className="text-sm text-cave-100">{t.blindAnswer.note}</p>
          {!answerRevealed ? <button type="button" className="btn-secondary w-full" onClick={() => setAnswerRevealed(true)}>{t.blindAnswer.open}</button> : <>
            {labelEditor}
            <label className="block text-sm">{t.blindAnswer.type}
              <select className="input-field mt-2" value={answerWineType} onChange={e => setAnswerWineType(e.target.value)}>
                <option value="">{t.blindAnswer.unknown}</option>
                {Object.entries(t.wineType).map(([key,label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
          </>}
        </section>}

        {/* Save Button */}
        <button onClick={handleSave} disabled={saving || saved || analyzing} className="btn-primary fixed bottom-[68px] left-1/2 z-40 w-[calc(100%-2rem)] max-w-[480px] -translate-x-1/2 py-4 text-sm shadow-lg">
          {saved ? `✓ ${t.tasting.saved}` : saving ? t.tasting.saving : t.tasting.save}
        </button>

      </div>
    </div>
  )
}
