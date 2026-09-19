import type { Language } from '@/i18n'
import { sommelierPersonalLine } from '@/lib/sommelierNote'

export function SommelierIcon() {
 return <svg viewBox="0 0 64 64" className="h-14 w-14 shrink-0" aria-hidden="true" fill="none">
  <circle cx="32" cy="32" r="31" fill="#fff1f3" stroke="#e5b5bf"/>
  <path d="M16 53c1-13 8-18 16-18s15 5 16 18" fill="#880c22"/>
  <path d="m26 36 6 8 6-8" fill="#fff"/>
  <circle cx="32" cy="24" r="12" fill="#f3d4b4"/>
  <path d="M20 22c-1-13 24-15 25 0-8-1-13-3-16-7-1 4-5 6-9 7Z" fill="#38282c"/>
  <path d="m27 42 5 3-5 3Zm10 0-5 3 5 3Z" fill="#202124"/>
  <path d="M28 28c2 2 6 2 8 0" stroke="#80512d" strokeWidth="1.5" strokeLinecap="round"/>
  <path d="M48 32h10v6a5 5 0 0 1-10 0Zm5 12v10m-4 0h8" stroke="#880c22" strokeWidth="2" strokeLinecap="round"/>
  <path d="M49 37h8v1a4 4 0 0 1-8 0Z" fill="#c8102e"/>
 </svg>
}
export default function SommelierNote({lang,result}:{lang:Language;result:{sommelierComment?:string|null;sommelierCommentSource?:string|null;matchScore?:number|null}}) {
 const fact = result.sommelierComment && result.sommelierCommentSource?.startsWith('https://') ? result.sommelierComment : null
 return <section className="flex items-start gap-3 py-3" aria-label={lang==='ja'?'ソムリエのひとこと':'소믈리에의 한마디'}>
  <SommelierIcon />
  <div className="relative min-w-0 flex-1 rounded-2xl rounded-tl-none border border-gold-200 bg-gold-50 p-4 shadow-sm">
   <h3 className="text-xs font-semibold text-gold-700 mb-2">{lang==='ja'?'ソムリエのひとこと':'소믈리에의 한마디'}</h3>
   {fact && <p className="text-sm leading-7 text-ink mb-2">{fact}</p>}
   <p className="text-sm leading-7 text-ink">{sommelierPersonalLine(lang,result.matchScore)}</p>
   {fact && <a className="mt-2 inline-block text-xs text-gold-700 underline" href={result.sommelierCommentSource!} target="_blank" rel="noopener noreferrer">{lang==='ja'?'ワイン情報の出典':'와인 정보 출처'} ↗</a>}
  </div>
 </section>
}
