'use client'
import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { translations, Language } from '@/i18n'
import type { User } from '@supabase/supabase-js'

interface Props {
  lang: Language
  user: User
  onBack: () => void
  blindSessionId?: string
  blindWineNumber?: number
}

export default function TastingSheet({ lang, user, onBack, blindSessionId, blindWineNumber }: Props) {
  const t = translations[lang]
  const fileRef = useRef<HTMLInputElement>(null)

  // State
  const [labelImageUrl, setLabelImageUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Wine Info
  const [wineName, setWineName] = useState('')
  const [producer, setProducer] = useState('')
  const [vintage, setVintage] = useState('')
  const [region, setRegion] = useState('')
  const [country, setCountry] = useState('')
  const [grapeVariety, setGrapeVariety] = useState('')
  const [wineType, setWineType] = useState('')
  const [wsScore, setWsScore] = useState('')
  const [waScore, setWaScore] = useState('')
  const [jsScore, setJsScore] = useState('')

  // Appearance
  const [colorHue, setColorHue] = useState('')
  const [colorDepth, setColorDepth] = useState('')
  const [clarity, setClarity] = useState('')
  const [viscosity, setViscosity] = useState('')

  // Nose
  const [noseIntensity, setNoseIntensity] = useState('')
  const [noseCondition, setNoseCondition] = useState('クリーン')
  const [aromas, setAromas] = useState<string[]>([])

  // Palate
  const [sweetness, setSweetness] = useState('')
  const [acidity, setAcidity] = useState('')
  const [tannin, setTannin] = useState('')
  const [tanninTexture, setTanninTexture] = useState('')
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
  const [readiness, setReadiness] = useState('')
  const [score, setScore] = useState(7)
  const [stars, setStars] = useState(0)
  const [notes, setNotes] = useState('')
  const [foodPairing, setFoodPairing] = useState<string[]>([])

  // Blind deduction
  const [deductionType, setDeductionType] = useState('')
  const [deductionClimate, setDeductionClimate] = useState('')
  const [deductionGrape, setDeductionGrape] = useState('')
  const [deductionRegion, setDeductionRegion] = useState('')
  const [deductionVintageRange, setDeductionVintageRange] = useState('')
  const [deductionPriceRange, setDeductionPriceRange] = useState('')
  const [deductionNotes, setDeductionNotes] = useState('')
  const [answerProducer, setAnswerProducer] = useState('')
  const [answerWine, setAnswerWine] = useState('')

  const isBlind = !!blindSessionId

  const handlePhotoUpload = async (file: File) => {
    setAnalyzing(true)
    try {
      // Upload to Supabase Storage
      const fileName = `${user.id}/${Date.now()}-${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('label-images')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('label-images')
        .getPublicUrl(fileName)

      setLabelImageUrl(publicUrl)

      // Analyze with Gemini Vision (only in normal mode)
      if (!isBlind) {
        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1]
          try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { text: `This is a wine label. Please extract the following information and respond ONLY in valid JSON format with these exact keys:
                    {
                      "wineName": "wine name or cuvee name",
                      "producer": "producer/chateau/winery name",
                      "vintage": "year as number or null",
                      "region": "specific region/appellation",
                      "country": "country",
                      "grapeVariety": "grape varieties if visible",
                      "wineType": "red or white or rose or sparkling or sweet"
                    }
                    If information is not visible on the label, use null. Do not include any text outside the JSON.` },
                    { inlineData: { mimeType: file.type, data: base64 } }
                  ]
                }]
              })
            })
            const data = await res.json()
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
            const jsonMatch = text.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              const info = JSON.parse(jsonMatch[0])
              if (info.wineName) setWineName(info.wineName)
              if (info.producer) setProducer(info.producer)
              if (info.vintage) setVintage(String(info.vintage))
              if (info.region) setRegion(info.region)
              if (info.country) setCountry(info.country)
              if (info.grapeVariety) setGrapeVariety(info.grapeVariety)
              if (info.wineType) setWineType(info.wineType)
            }
          } catch (e) { console.error('AI analysis failed:', e) }
        }
        reader.readAsDataURL(file)
      }
    } catch (e) {
      console.error('Upload failed:', e)
    } finally {
      setAnalyzing(false)
    }
  }

  const toggleAroma = (aroma: string) => {
    setAromas(prev => prev.includes(aroma) ? prev.filter(a => a !== aroma) : [...prev, aroma])
  }

  const toggleFoodPairing = (food: string) => {
    setFoodPairing(prev => prev.includes(food) ? prev.filter(f => f !== food) : [...prev, food])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('tastings').insert({
        user_id: user.id,
        mode: isBlind ? 'blind' : 'normal',
        blind_session_id: blindSessionId || null,
        blind_wine_number: blindWineNumber || null,
        wine_name: isBlind ? null : wineName || null,
        producer: isBlind ? null : producer || null,
        vintage: isBlind ? null : (vintage ? parseInt(vintage) : null),
        region: isBlind ? null : region || null,
        country: isBlind ? null : country || null,
        grape_variety: isBlind ? null : grapeVariety || null,
        wine_type: wineType || null,
        label_image_url: labelImageUrl || null,
        color_hue: colorHue || null,
        color_depth: colorDepth || null,
        clarity: clarity || null,
        viscosity: viscosity || null,
        nose_intensity: noseIntensity || null,
        nose_condition: noseCondition || null,
        aromas: aromas.length > 0 ? aromas : null,
        sweetness: sweetness || null,
        acidity: acidity || null,
        tannin: tannin || null,
        tannin_texture: tanninTexture || null,
        alcohol: alcohol || null,
        body: body || null,
        flavor_intensity: flavorIntensity || null,
        finish: finish || null,
        blic_balance: blicB || null,
        blic_length: blicL || null,
        blic_intensity: blicI || null,
        blic_complexity: blicC || null,
        quality: quality || null,
        readiness: readiness || null,
        deduction_type: isBlind ? deductionType || null : null,
        deduction_climate: isBlind ? deductionClimate || null : null,
        deduction_grape: isBlind ? deductionGrape || null : null,
        deduction_region: isBlind ? deductionRegion || null : null,
        deduction_vintage_range: isBlind ? deductionVintageRange || null : null,
        deduction_price_range: isBlind ? deductionPriceRange || null : null,
        deduction_notes: isBlind ? deductionNotes || null : null,
        answer_producer: isBlind ? answerProducer || null : null,
        answer_wine: isBlind ? answerWine || null : null,
        score: score || null,
        stars: stars || null,
        notes: notes || null,
        food_pairing: foodPairing.length > 0 ? foodPairing : null,
        ws_score: wsScore ? parseInt(wsScore) : null,
        wa_score: waScore ? parseInt(waScore) : null,
        js_score: jsScore ? parseInt(jsScore) : null,
        language: lang,
      })
      if (error) throw error
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        onBack()
      }, 1500)
    } catch (e) {
      console.error('Save failed:', e)
      alert(t.common.error)
    } finally {
      setSaving(false)
    }
  }

  const ScaleRow = ({ label, hint, options, value, onChange }: any) => (
    <div className="mb-4">
      <div className="text-xs font-medium text-gray-700 mb-0.5">{label}</div>
      {hint && <div className="text-[10px] text-gray-400 mb-1">{hint}</div>}
      <div className="flex border border-gray-200 overflow-hidden">
        {options.map((opt: string) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
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
          onClick={() => onChange(n)}
          className={`w-4 h-4 rounded-full border transition-colors ${
            n <= value ? 'bg-wine-800 border-wine-800' : 'border-gray-300 bg-white'
          }`}
        />
      ))}
    </div>
  )

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-14 bg-parchment border-b border-gray-200 px-4 py-3 flex items-center justify-between z-40">
        <button onClick={onBack} className="text-wine-700 text-sm">← {t.common.back}</button>
        <div className="text-xs font-medium tracking-widest uppercase text-wine-800">
          {isBlind ? `${t.blind.wine} ${blindWineNumber}` : t.tasting.normal}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className="btn-primary py-1.5 px-4 text-[10px]"
        >
          {saved ? '✓' : saving ? '...' : t.tasting.save}
        </button>
      </div>

      <div className="p-4 space-y-6">

        {/* Label Photo */}
        <div>
          <div className="section-title">{t.tasting.labelPhoto}</div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
          />
          {labelImageUrl ? (
            <div className="relative">
              <img src={labelImageUrl} alt="label" className="w-full max-h-64 object-contain bg-gray-50" />
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-2 right-2 bg-wine-800 text-white text-xs px-3 py-1"
              >
                {lang === 'ja' ? '撮り直す' : '다시 찍기'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={analyzing}
              className="w-full border-2 border-dashed border-wine-200 py-10 text-center text-gray-400 hover:border-wine-400 transition-colors"
            >
              {analyzing ? (
                <div>
                  <div className="text-2xl animate-pulse">🔍</div>
                  <div className="text-xs mt-2">{t.tasting.analyzing}</div>
                </div>
              ) : (
                <div>
                  <div className="text-3xl">📷</div>
                  <div className="text-xs mt-2">{t.tasting.takePhoto}</div>
                  {!isBlind && <div className="text-[10px] text-wine-400 mt-1">AI {t.tasting.autoFilled}</div>}
                </div>
              )}
            </button>
          )}
        </div>

        {/* Wine Info (normal mode only) */}
        {!isBlind && (
          <div>
            <div className="section-title">{lang === 'ja' ? 'ワイン情報' : '와인 정보'}</div>
            <div className="space-y-3">
              {[
                { label: t.tasting.wineName, value: wineName, onChange: setWineName },
                { label: t.tasting.producer, value: producer, onChange: setProducer },
                { label: t.tasting.vintage, value: vintage, onChange: setVintage, type: 'number' },
                { label: t.tasting.region, value: region, onChange: setRegion },
                { label: t.tasting.country, value: country, onChange: setCountry },
                { label: t.tasting.grapeVariety, value: grapeVariety, onChange: setGrapeVariety },
              ].map(field => (
                <div key={field.label}>
                  <label className="text-[10px] tracking-widest uppercase text-wine-700 mb-0.5 block">{field.label}</label>
                  <input
                    type={field.type || 'text'}
                    value={field.value}
                    onChange={e => field.onChange(e.target.value)}
                    className="input-field"
                  />
                </div>
              ))}

              {/* Wine Type */}
              <div>
                <label className="text-[10px] tracking-widest uppercase text-wine-700 mb-1 block">{lang === 'ja' ? 'タイプ' : '타입'}</label>
                <ChipGroup
                  options={Object.values(t.wineType)}
                  selected={wineType}
                  onToggle={setWineType}
                  single
                />
              </div>

              {/* Expert Scores */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'WS', value: wsScore, onChange: setWsScore },
                  { label: 'WA', value: waScore, onChange: setWaScore },
                  { label: 'JS', value: jsScore, onChange: setJsScore },
                ].map(s => (
                  <div key={s.label}>
                    <label className="text-[10px] tracking-widest uppercase text-wine-700 mb-0.5 block">{s.label}</label>
                    <input
                      type="number"
                      value={s.value}
                      onChange={e => s.onChange(e.target.value)}
                      placeholder="--"
                      className="input-field text-center"
                      min="0" max="100"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ① Appearance */}
        <div>
          <div className="section-title">① {t.tasting.appearance}</div>
          <ScaleRow label={t.tasting.colorHue} options={t.appearance.colorHues} value={colorHue} onChange={setColorHue} />
          <ScaleRow label={t.tasting.colorDepth} options={t.appearance.depthLevels} value={colorDepth} onChange={setColorDepth} />
          <ScaleRow label={t.tasting.clarity} options={t.appearance.clarityLevels} value={clarity} onChange={setClarity} />
          <ScaleRow label={t.tasting.viscosity} options={t.appearance.viscosityLevels} value={viscosity} onChange={setViscosity} />
        </div>

        {/* ② Nose */}
        <div>
          <div className="section-title">② {t.tasting.nose}</div>
          <ScaleRow label={t.tasting.noseIntensity} options={t.nose.intensityLevels} value={noseIntensity} onChange={setNoseIntensity} />
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-700 mb-1">{t.tasting.noseCondition}</div>
            <ChipGroup options={t.nose.conditions} selected={noseCondition} onToggle={setNoseCondition} single />
          </div>
          <div className="mb-2">
            <div className="text-xs font-medium text-gray-700 mb-1">
              {lang === 'ja' ? '一次アロマ（果実・花・ハーブ）' : '1차 아로마 (과실·꽃·허브)'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {t.nose.primaryAromas.map(a => (
                <button key={a} onClick={() => toggleAroma(a)} className={`chip ${aromas.includes(a) ? 'chip-on' : ''}`}>{a}</button>
              ))}
            </div>
          </div>
          <div className="mb-2">
            <div className="text-xs font-medium text-gray-700 mb-1">
              {lang === 'ja' ? '二次アロマ（発酵）' : '2차 아로마 (발효)'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {t.nose.secondaryAromas.map(a => (
                <button key={a} onClick={() => toggleAroma(a)} className={`chip ${aromas.includes(a) ? 'chip-on' : ''}`}>{a}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-700 mb-1">
              {lang === 'ja' ? '三次アロマ（熟成）' : '3차 아로마 (숙성)'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {t.nose.tertiaryAromas.map(a => (
                <button key={a} onClick={() => toggleAroma(a)} className={`chip ${aromas.includes(a) ? 'chip-on' : ''}`}>{a}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ③ Palate */}
        <div>
          <div className="section-title">③ {t.tasting.palate}</div>
          <ScaleRow label={t.tasting.sweetness} hint={lang === 'ja' ? '口に感じる甘さ' : '입에서 느끼는 단맛'} options={t.palate.sweetnessLevels} value={sweetness} onChange={setSweetness} />
          <ScaleRow label={t.tasting.acidity} hint={lang === 'ja' ? '唾液が多く出れば高い' : '침이 많이 나오면 높음'} options={t.palate.acidityLevels} value={acidity} onChange={setAcidity} />
          <ScaleRow label={t.tasting.tannin} hint={lang === 'ja' ? '歯茎の乾燥感（赤のみ）' : '잇몸 건조감 (레드만)'} options={t.palate.tanninLevels} value={tannin} onChange={setTannin} />
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-700 mb-1">{t.tasting.tanninTexture}</div>
            <ChipGroup options={t.palate.tanninTextures} selected={tanninTexture} onToggle={setTanninTexture} single />
          </div>
          <ScaleRow label={t.tasting.alcohol} hint={lang === 'ja' ? '喉に感じる熱さ' : '목에서 느끼는 열감'} options={t.palate.alcoholLevels} value={alcohol} onChange={setAlcohol} />
          <ScaleRow label={t.tasting.body} hint={lang === 'ja' ? '口の中の重量感' : '입 안의 무게감'} options={t.palate.bodyLevels} value={body} onChange={setBody} />
          <ScaleRow label={t.tasting.flavorIntensity} options={t.palate.intensityLevels} value={flavorIntensity} onChange={setFlavorIntensity} />
          <ScaleRow label={t.tasting.finish} hint={lang === 'ja' ? '飲み込んだ後の持続時間' : '삼킨 후 지속 시간'} options={t.palate.finishLevels} value={finish} onChange={setFinish} />
          <textarea
            value={palateNotes}
            onChange={e => setPalateNotes(e.target.value)}
            placeholder={lang === 'ja' ? '味わいに関するメモ...' : '미각 관련 메모...'}
            className="w-full border border-gray-200 p-3 text-sm resize-none h-16 focus:outline-none focus:border-wine-400 bg-white"
          />
        </div>

        {/* ④ Conclusions */}
        <div>
          <div className="section-title">④ {t.tasting.conclusions}</div>

          {/* BLIC */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { key: 'B', label: lang === 'ja' ? 'Balance バランス' : 'Balance 균형', val: blicB, set: setBlicB, hint: lang === 'ja' ? '酸・タンニン・果実の調和' : '산·타닌·과실의 조화' },
              { key: 'L', label: lang === 'ja' ? 'Length 余韻' : 'Length 여운', val: blicL, set: setBlicL, hint: lang === 'ja' ? '飲み込んだ後の持続' : '삼킨 후 지속' },
              { key: 'I', label: lang === 'ja' ? 'Intensity 強度' : 'Intensity 강도', val: blicI, set: setBlicI, hint: lang === 'ja' ? '香りと味の集中度' : '향과 맛의 집중도' },
              { key: 'C', label: lang === 'ja' ? 'Complexity 複雑さ' : 'Complexity 복잡도', val: blicC, set: setBlicC, hint: lang === 'ja' ? '層の豊かさ' : '층위의 풍성함' },
            ].map(b => (
              <div key={b.key} className="card p-3">
                <div className="font-serif text-lg text-wine-800">{b.key}</div>
                <div className="text-[10px] text-gray-600 font-medium">{b.label}</div>
                <div className="text-[9px] text-gray-400 mb-2">{b.hint}</div>
                <BlicDots value={b.val} onChange={b.set} />
              </div>
            ))}
          </div>

          <ScaleRow label={lang === 'ja' ? 'WSET品質等級' : 'WSET 품질 등급'} options={t.conclusions.qualityLevels} value={quality} onChange={setQuality} />
          <ScaleRow label={lang === 'ja' ? '飲み頃' : '음용 시기'} options={t.conclusions.readinessLevels} value={readiness} onChange={setReadiness} />
        </div>

        {/* Blind Deduction */}
        {isBlind && (
          <div>
            <div className="section-title bg-wine-900 text-white p-2 -mx-4 px-4 mb-4">
              🔍 {t.tasting.deduction}
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-xs font-medium text-gray-700 mb-1">{lang === 'ja' ? '予想タイプ' : '예상 타입'}</div>
                <ChipGroup options={t.conclusions.deductionTypes} selected={deductionType} onToggle={setDeductionType} single />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-700 mb-1">{lang === 'ja' ? '予想気候' : '예상 기후'}</div>
                <ChipGroup options={t.conclusions.climates} selected={deductionClimate} onToggle={setDeductionClimate} single />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-700 mb-1">{lang === 'ja' ? '予想品種' : '예상 품종'}</div>
                <ChipGroup options={t.conclusions.grapes} selected={deductionGrape} onToggle={setDeductionGrape} single />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-700 mb-1">{lang === 'ja' ? '予想産地' : '예상 산지'}</div>
                <ChipGroup options={t.conclusions.regions} selected={deductionRegion} onToggle={setDeductionRegion} single />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-700 mb-1">{lang === 'ja' ? '予想ヴィンテージ' : '예상 빈티지'}</div>
                <ChipGroup options={t.conclusions.vintageRanges} selected={deductionVintageRange} onToggle={setDeductionVintageRange} single />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-700 mb-1">{lang === 'ja' ? '予想価格帯' : '예상 가격대'}</div>
                <ChipGroup options={t.conclusions.priceRanges} selected={deductionPriceRange} onToggle={setDeductionPriceRange} single />
              </div>
              <textarea
                value={deductionNotes}
                onChange={e => setDeductionNotes(e.target.value)}
                placeholder={lang === 'ja' ? '推論の根拠...' : '추론 근거...'}
                className="w-full border border-gray-200 p-3 text-sm resize-none h-16 focus:outline-none focus:border-wine-400 bg-white"
              />

              {/* Answer */}
              <div className="bg-wine-50 border border-wine-200 p-4">
                <div className="text-xs font-medium text-wine-800 mb-3 tracking-widest uppercase">{t.tasting.answer}</div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-wine-600">{t.tasting.answerProducer}</label>
                    <input value={answerProducer} onChange={e => setAnswerProducer(e.target.value)} className="input-field" />
                  </div>
                  <div>
                    <label className="text-[10px] text-wine-600">{t.tasting.answerWine}</label>
                    <input value={answerWine} onChange={e => setAnswerWine(e.target.value)} className="input-field" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Score */}
        <div>
          <div className="section-title">{t.tasting.score}</div>
          <div className="bg-wine-800 text-white p-6 text-center">
            <div className="font-serif text-7xl font-bold leading-none">{score}</div>
            <div className="text-wine-300 text-xs mt-1">/10</div>
            <input
              type="range" min="1" max="10" value={score}
              onChange={e => setScore(parseInt(e.target.value))}
              className="w-40 mt-4 accent-white"
            />
            <div className="flex justify-center gap-2 mt-3">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setStars(n)} className={`text-xl ${n <= stars ? 'text-yellow-400' : 'text-white/20'}`}>★</button>
              ))}
            </div>
          </div>
        </div>

        {/* Food Pairing */}
        <div>
          <div className="section-title">{t.tasting.foodPairing}</div>
          <div className="flex flex-wrap gap-1.5">
            {t.foodPairings.map(f => (
              <button key={f} onClick={() => toggleFoodPairing(f)} className={`chip ${foodPairing.includes(f) ? 'chip-on' : ''}`}>{f}</button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <div className="section-title">{t.tasting.notes}</div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={lang === 'ja' ? 'テイスティングノート...' : '테이스팅 노트...'}
            className="w-full border border-gray-200 p-3 text-sm resize-none h-24 focus:outline-none focus:border-wine-400 bg-white font-serif italic"
          />
        </div>

        {/* Save Button */}
        <button onClick={handleSave} disabled={saving || saved} className="btn-primary w-full py-4 text-sm">
          {saved ? `✓ ${t.tasting.saved}` : saving ? t.tasting.saving : t.tasting.save}
        </button>

      </div>
    </div>
  )
}
