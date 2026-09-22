import type { Language } from '@/i18n'
import { sommelierText } from '@/i18n/sommelier'
export default function SommelierDetails({lang,result}:{lang:Language;result:{profile?:Partial<Record<'visual'|'nose'|'aging'|'body'|'acidity'|'sweetness'|'tannin'|'finish'|'pairing',string|null>>;servingTemperature?:string|null}}) {
 const t=sommelierText[lang],p=result.profile || {}
 const hasProfile=Object.values(p).some(Boolean)
 return <>
  <p className="text-xs leading-6 text-cave-100">{hasProfile ? t.estimated : t.unknown}</p>
  {([['visual','👁'],['nose','👃'],['aging','🪵']] as const).map(([key,icon])=>p[key] && <section key={key} className="card p-4"><h3 className="font-semibold text-ink mb-2">{icon} {t[key]}</h3><p className="text-sm leading-7 text-ink">{p[key]}</p></section>)}
  {(['body','acidity','sweetness','tannin'] as const).some(k=>p[k]) && <section className="card p-4"><h3 className="font-semibold mb-2 text-ink">👅 {t.style}</h3><dl className="divide-y divide-cave-400/40">{(['body','acidity','sweetness','tannin'] as const).map(k=>p[k] && <div key={k} className="grid grid-cols-[88px_1fr] gap-3 py-2 text-sm leading-6"><dt className="text-cave-100">{t[k]}</dt><dd className="text-ink">{p[k]}</dd></div>)}</dl></section>}
  {p.finish && <section className="card p-4"><h3 className="font-semibold text-ink mb-2">⏳ {t.finish}</h3><p className="text-sm leading-7 text-ink">{p.finish}</p></section>}
  <section className="card p-4 border-gold-300"><h3 className="font-semibold text-ink mb-2">🍽 {t.pairing}</h3><p className="text-sm leading-7 text-ink">{p.pairing || t.noPairing}</p>
   {result.servingTemperature && <div className="mt-4 border-t border-gold-200 pt-4"><h3 className="text-sm text-ink">🌡 {t.temperature}</h3><p className="text-2xl font-serif text-gold-700 mt-1">{result.servingTemperature}</p><p className="text-xs text-cave-100 leading-6 mt-1">{t.tempHint}</p></div>}
  </section>
 </>
}
