'use client'
import { useEffect, useRef } from 'react'
import { translations, type Language } from '@/i18n'
export type AnalysisStage = 'upload' | 'analyze' | 'organize'

export default function AnalysisProgress({ imageUrl, lang, stage, mode, onCancel }: {
  imageUrl: string; lang: Language; stage: AnalysisStage; mode: 'label' | 'sommelier' | 'upload'; onCancel: () => void
}) {
  const t = translations[lang].analysis
  const dialog = useRef<HTMLDivElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.focus()
    return () => { document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  const current = stage === 'upload' ? 0 : stage === 'analyze' ? 1 : 2
  const steps = mode === 'upload' ? [t.uploadTitle] : [t.upload, t.analyze, t.organize]
  return <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="analysis-title" tabIndex={-1}
    className="fixed inset-0 z-[100] bg-[#0d111a] overflow-y-auto outline-none"
    onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); onCancel() }; if (e.key === 'Tab') { e.preventDefault(); cancel.current?.focus() } }}>
    <div className="min-h-[100dvh] max-w-md mx-auto px-7 py-8 flex flex-col items-center justify-center gap-5" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
      <div className="analysis-photo relative w-44 h-52 sm:w-52 sm:h-60 rounded-2xl overflow-hidden border border-gold-500/50 bg-black/40 shadow-[0_0_35px_rgba(201,168,118,.08)]">
        <img src={imageUrl} alt="" className="w-full h-full object-contain" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />
        {mode !== 'upload' && <div aria-hidden="true" className="analysis-scan absolute left-0 right-0 h-16 border-b border-gold-300 bg-gradient-to-t from-gold-400/30 to-transparent" />}
        <span aria-hidden="true" className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-gold-300" />
        <span aria-hidden="true" className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-gold-300" />
      </div>
      <div className="text-center space-y-2" role="status" aria-live="polite">
        <h2 id="analysis-title" className="text-xl text-[#f5ebd6] font-medium">{mode === 'upload' ? t.uploadTitle : t.title}</h2>
        <p className="text-xs leading-6 text-[#b7bdcb]">{t.subtitle}</p>
        <p className="sr-only">{steps[mode === 'upload' ? 0 : current]}</p>
      </div>
      <ol className="w-full space-y-2.5" aria-label={t.title}>
        {steps.map((text, i) => <li key={text} aria-current={i === current ? 'step' : undefined}
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-sm ${i <= current ? 'border-gold-500/40 bg-[#1c2332] text-gold-200' : 'border-[#303849] bg-[#171e2b] text-[#a8afbe]'}`}>
          <span>{text}</span>
          <span aria-hidden="true">{i < current ? '✓' : i === current ? <span className="block w-5 h-5 rounded-full border-2 border-gold-300/20 border-t-gold-300 motion-safe:animate-spin" /> : <span className="block w-8 h-1 rounded bg-[#343d50]" />}</span>
        </li>)}
      </ol>
      {mode !== 'upload' && <p className="text-center text-xs leading-6 text-[#b7bdcb]">{mode === 'label' ? t.labelDetail : t.sommelierDetail}<br />{t.notice}</p>}
      <button ref={cancel} onClick={onCancel} className="min-h-11 px-8 text-sm text-[#bdc3d0] underline underline-offset-4">{t.cancel}</button>
    </div>
  </div>
}
