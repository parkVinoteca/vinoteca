'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { translations, Language } from '@/i18n'
import { resolveLabelImage, labelImagePath } from '@/lib/labelImages'
import type { User } from '@supabase/supabase-js'

interface Props { lang: Language; user: User; onBack: () => void }

export default function MyCellar({ lang, user, onBack }: Props) {
  const t = translations[lang]
  const [error, setError] = useState('')
  const [tastings, setTastings] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date')
  const [filterCountry, setFilterCountry] = useState('')
  const [filterGrape, setFilterGrape] = useState('')
  const [filterType, setFilterType] = useState('')
  const [countries, setCountries] = useState<string[]>([])
  const [grapes, setGrapes] = useState<string[]>([])
  const [selected, setSelected] = useState<any>(null)

  useEffect(() => { loadTastings().catch(() => { setError(t.common.error); setLoading(false) }) }, [user.id])

  useEffect(() => {
    let data = [...tastings]
    if (filterCountry) data = data.filter(d => d.country === filterCountry)
    if (filterGrape) data = data.filter(d => d.grape_variety?.includes(filterGrape))
    if (filterType) data = data.filter(d => d.wine_type === filterType)
    if (sortBy === 'score') data.sort((a, b) => (b.score || 0) - (a.score || 0))
    else data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setFiltered(data)
  }, [tastings, filterCountry, filterGrape, filterType, sortBy])

  const loadTastings = async () => {
    setError('')
    const data: any[] = []
    for (let from = 0; ; from += 500) {
      const { data: page, error } = await supabase.from('tastings').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).order('id').range(from, from + 499)
      if (error) { setError(t.common.error); setLoading(false); return }
      data.push(...(page || [])); if (!page || page.length < 500) break
    }
    if (data) {
      const resolved = await Promise.all(data.map(async row => ({ ...row, image_url: await resolveLabelImage(row.label_image_url, user.id) })))
      setTastings(resolved)
      setCountries([...new Set(data.map(d => d.country).filter(Boolean))] as string[])
      setGrapes([...new Set(data.map(d => d.grape_variety).filter(Boolean))] as string[])
    }
    setLoading(false)
  }

  const deleteTasting = async (id: string) => {
    if (!confirm(lang === 'ja' ? '削除しますか？' : '삭제하시겠습니까?')) return
    const imagePath = selected?.label_image_url ? labelImagePath(selected.label_image_url, user.id) : null
    const { error } = await supabase.from('tastings').delete().eq('id', id).eq('user_id', user.id)
    if (error) { setError(t.common.error); return }
    setSelected(null)
    await loadTastings()
    if (imagePath) {
      const { error: imageError } = await supabase.storage.from('label-images').remove([imagePath])
      if (imageError) setError(lang === 'ja' ? '記録を削除しましたが、写真の削除に失敗しました。' : '기록은 삭제했지만 사진을 삭제하지 못했습니다.')
    }
  }

  if (selected) {
    return (
      <div className="max-w-lg mx-auto">
        {error && <p role="alert" className="card p-3">{error}</p>}
        <div className="sticky top-14 bg-parchment border-b border-cave-400/30 px-4 py-3 flex items-center justify-between z-40">
          <button onClick={() => setSelected(null)} className="text-gold-400 text-sm">← {t.common.back}</button>
          <button onClick={() => deleteTasting(selected.id).catch(() => setError(t.common.error))} className="text-red-500 text-xs">{t.common.delete}</button>
        </div>
        <div className="p-4">
          {selected.image_url && (
            <img src={selected.image_url} alt="" className="w-full max-h-64 object-contain bg-cave-600/30 mb-4" />
          )}
          <div className="card p-4 mb-4">
            <div className="font-serif text-xl text-gold-300 mb-1">{selected.wine_name || selected.producer || '—'}</div>
            {selected.producer && selected.wine_name && <div className="text-sm text-cave-100 mb-2">{selected.producer}</div>}
            <div className="flex flex-wrap gap-2 text-xs text-cave-100">
              {selected.vintage && <span className="bg-cave-600/50 px-2 py-0.5">{selected.vintage}</span>}
              {selected.region && <span className="bg-cave-600/50 px-2 py-0.5">{selected.region}</span>}
              {selected.country && <span className="bg-cave-600/50 px-2 py-0.5">{selected.country}</span>}
              {selected.grape_variety && <span className="bg-cave-600/50 px-2 py-0.5">{selected.grape_variety}</span>}
            </div>
          </div>

          {/* Expert Scores */}
          {(selected.ws_score || selected.wa_score || selected.js_score) && (
            <div className="card p-3 mb-3 flex gap-4">
              {[['WS', selected.ws_score], ['WA', selected.wa_score], ['JS', selected.js_score]].map(([k, v]) => v && (
                <div key={k} className="text-center">
                  <div className="text-[10px] text-cave-100">{k}</div>
                  <div className="font-serif text-lg text-gold-300">{v}</div>
                </div>
              ))}
            </div>
          )}

          {selected.palate_notes && <div className="card p-3 mb-3"><h3 className="text-sm">{lang === 'ja' ? '味わいのメモ' : '입안에서 느낀 메모'}</h3><p className="text-sm whitespace-pre-wrap">{selected.palate_notes}</p></div>}
          {/* My Score */}
          {selected.score && (
            <div className="bg-gradient-to-b from-gold-500 to-gold-600 text-white p-4 text-center mb-3">
              <div className="text-xs text-gold-500/50 mb-1">{lang === 'ja' ? 'マイスコア' : '내 점수'}</div>
              <div className="font-serif text-5xl font-bold">{selected.score}</div>
              {selected.stars && (
                <div className="mt-1">{'★'.repeat(selected.stars)}{'☆'.repeat(5-selected.stars)}</div>
              )}
            </div>
          )}

          {/* Tasting Data */}
          {[
            { label: lang === 'ja' ? '外観' : '외관', data: [selected.color_hue, selected.color_depth, selected.clarity, selected.viscosity].filter(Boolean) },
            { label: lang === 'ja' ? '香り' : '향', data: [selected.nose_intensity, selected.nose_condition, ...(selected.aromas || [])].filter(Boolean) },
            { label: lang === 'ja' ? '味わい' : '미각', data: [selected.sweetness, selected.acidity, selected.tannin, selected.body, selected.finish].filter(Boolean) },
          ].map(section => section.data.length > 0 && (
            <div key={section.label} className="card p-3 mb-3">
              <div className="text-xs font-medium text-gold-400 mb-2">{section.label}</div>
              <div className="flex flex-wrap gap-1">
                {section.data.map(d => <span key={d} className="text-xs bg-gold-900/20 text-gold-400 px-2 py-0.5">{d}</span>)}
              </div>
            </div>
          ))}

          {selected.notes && (
            <div className="card p-4 mb-3">
              <div className="text-xs font-medium text-gold-400 mb-2">{t.tasting.notes}</div>
              <div className="font-serif italic text-sm text-cave-50">{selected.notes}</div>
            </div>
          )}

          {/* Blind Results */}
          {selected.mode === 'blind' && (
            <div className="bg-gold-900/20 border border-gold-900/30 p-4">
              <div className="text-xs font-medium text-gold-300 mb-3">🎭 {lang === 'ja' ? 'ブラインド結果' : '블라인드 결과'}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  [lang === 'ja' ? '予想タイプ' : '예상 타입', selected.deduction_type],
                  [lang === 'ja' ? '予想品種' : '예상 품종', selected.deduction_grape],
                  [lang === 'ja' ? '予想産地' : '예상 산지', selected.deduction_region],
                  [lang === 'ja' ? '予想価格' : '예상 가격', selected.deduction_price_range],
                ].map(([k, v]) => v && (
                  <div key={k}>
                    <div className="text-cave-100">{k}</div>
                    <div className="font-medium text-gold-300">{v}</div>
                  </div>
                ))}
              </div>
              {(selected.answer_producer || selected.answer_wine) && (
                <div className="mt-3 pt-3 border-t border-gold-900/30">
                  <div className="text-[10px] text-gold-400 mb-1">{t.tasting.answer}</div>
                  <div className="font-medium text-gold-200">{selected.answer_producer} {selected.answer_wine}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      {error && <p role="alert" className="card p-3">{error}</p>}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="section-title mb-0">{t.cellar.title}</div>
          <div className="text-xs text-cave-100">{t.cellar.total} {filtered.length}{lang === 'ja' ? '本' : '병'}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 mb-4 space-y-2">
        <div className="flex gap-2">
          <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)} className="flex-1 text-xs border border-cave-400/30 p-1.5 bg-cave-600/40 text-cave-50">
            <option value="">{t.cellar.all} {t.cellar.country}</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="flex-1 text-xs border border-cave-400/30 p-1.5 bg-cave-600/40 text-cave-50">
            <option value="">{t.cellar.all} {t.cellar.type}</option>
            {Object.entries(t.wineType).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setSortBy('date')} className={`flex-1 text-xs py-1.5 border transition-colors ${sortBy === 'date' ? 'bg-gradient-to-b from-gold-500 to-gold-600 text-white border-gold-600' : 'border-cave-400/30 text-cave-100'}`}>
            {t.cellar.sortDate}
          </button>
          <button onClick={() => setSortBy('score')} className={`flex-1 text-xs py-1.5 border transition-colors ${sortBy === 'score' ? 'bg-gradient-to-b from-gold-500 to-gold-600 text-white border-gold-600' : 'border-cave-400/30 text-cave-100'}`}>
            {t.cellar.sortScore}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-cave-100 text-sm">{t.common.loading}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-cave-100">
          <div className="text-4xl mb-3">📚</div>
          <div className="text-sm">{t.cellar.noData}</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(tasting => (
            <button key={tasting.id} onClick={() => setSelected(tasting)} className="w-full card p-3 flex items-center gap-3 hover:bg-gold-900/20 transition-colors text-left">
              {tasting.image_url ? (
                <img src={tasting.image_url} alt="" className="w-10 h-14 object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-14 bg-cave-500/40 flex items-center justify-center text-gold-500/50 flex-shrink-0">🍷</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-ink truncate">
                  {tasting.wine_name || tasting.producer || (lang === 'ja' ? '名称未設定' : '이름 없음')}
                </div>
                <div className="text-xs text-cave-100 truncate">
                  {[tasting.vintage, tasting.region, tasting.country].filter(Boolean).join(' · ')}
                </div>
                <div className="text-xs text-cave-200">
                  {new Date(tasting.created_at).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'ko-KR')}
                  {tasting.mode === 'blind' && ` · 🎭`}
                </div>
              </div>
              {tasting.score && (
                <div className="font-serif text-2xl font-bold text-gold-300 flex-shrink-0">{tasting.score}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
