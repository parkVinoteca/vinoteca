import { readableCriticScores } from '@/lib/criticScores'
import { translations, type Language } from '@/i18n'
export default function CriticScores({ value, lang }: { value: unknown; lang: Language }) {
  const scores = readableCriticScores(value)
  if (!scores.length) return null
  return <section className="card p-3 mb-3" aria-label={translations[lang].tastingGuide.sources}>
    <h3 className="text-xs text-cave-100 mb-2">{translations[lang].tastingGuide.sources}</h3>
    <div className="flex flex-wrap gap-4">{scores.map(item => <a key={item.critic} href={item.source} target="_blank" rel="noopener noreferrer" className="text-gold-700 underline text-sm" title={item.evidence}>{item.critic} {item.score} / 100 · {item.vintage} ↗</a>)}</div>
  </section>
}
