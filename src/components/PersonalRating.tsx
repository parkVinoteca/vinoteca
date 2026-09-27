import { translations, type Language } from '@/i18n'

export default function PersonalRating({ lang, value, onChange }: { lang: Language; value: number; onChange: (n: number) => void }) {
  const t = translations[lang].rating
  return <section className="card p-4" aria-label={t.title}>
    <h3 className="section-title">{t.title}</h3>
    <div className="text-center">
      <output className="font-serif text-5xl text-gold-700" aria-live="polite">{value ? value.toFixed(1) : '—'}<span className="text-base"> / 5</span></output>
      <p className="mt-2 text-sm text-cave-50">{value ? t.levels[Math.min(4, Math.max(0, Math.round(value) - 1))] : t.unrated}</p>
    </div>
    <input aria-label={t.title} aria-describedby="personal-rating-guide" aria-valuetext={value ? `${value.toFixed(1)} / 5` : t.unrated} type="range" min="1" max="5" step="0.1" value={value || 3} onChange={e => onChange(Number(e.target.value))} className="simple-range mt-3 w-full" />
    <div aria-hidden="true" className="flex justify-between px-2 text-xs text-cave-100">{[1,2,3,4,5].map(n => <span key={n}>{n.toFixed(1)}</span>)}</div>
    <p id="personal-rating-guide" className="mt-3 flex justify-between gap-3 text-xs text-cave-50"><span>{t.low}</span><span>{t.high}</span></p>
    {value > 0 && <button type="button" className="mt-2 min-h-11 text-xs underline" onClick={() => onChange(0)}>{t.clear}</button>}
  </section>
}
