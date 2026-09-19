import { translations, type Language } from '@/i18n'

export default function PersonalRating({ lang, value, onChange }: { lang: Language; value: number; onChange: (n: number) => void }) {
  const t = translations[lang].rating
  return <section className="card p-4" aria-label={t.title}>
    <h3 className="section-title">{t.title}</h3>
    <div className="flex items-center justify-center gap-5">
      <button className="chip min-h-11 min-w-11" aria-label={t.decrease} disabled={value <= 1} onClick={() => onChange(Math.round((value - .1) * 10) / 10)}>−</button>
      <output className="font-serif text-5xl text-gold-700" aria-live="polite">{value ? value.toFixed(1) : '—'}<span className="text-base"> / 5</span></output>
      <button className="chip min-h-11 min-w-11" aria-label={t.increase} disabled={value >= 5} onClick={() => onChange(value ? Math.round((value + .1) * 10) / 10 : 3.5)}>＋</button>
    </div>
    <div className="my-3 flex flex-wrap justify-center gap-2">{[1,2,3,3.5,4,4.5,5].map(n => <button key={n} className={`chip min-h-11 ${value === n ? 'chip-on' : ''}`} aria-pressed={value === n} onClick={() => onChange(n)}>{n.toFixed(1)}</button>)}</div>
    <input aria-label={t.title} aria-valuetext={value ? `${value.toFixed(1)} / 5` : t.unrated} type="range" min="1" max="5" step="0.1" value={value || 3.5} onChange={e => onChange(Number(e.target.value))} className="simple-range w-full" />
    <p className="mt-3 text-sm text-cave-50">{t.guide}</p>
    <p className="mt-2 text-xs text-cave-100">{t.note}</p>
    {value > 0 && <button className="mt-2 min-h-11 text-xs underline" onClick={() => onChange(0)}>{t.clear}</button>}
  </section>
}
