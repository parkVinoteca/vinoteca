'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { translations, Language } from '@/i18n'
import TastingSheet from './TastingSheet'
import type { User } from '@supabase/supabase-js'

interface Props { lang: Language; user: User; onBack: () => void }

export default function BlindMode({ lang, user, onBack }: Props) {
  const t = translations[lang]
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const createLock = useRef(false)
  const [sessions, setSessions] = useState<any[]>([])
  const [view, setView] = useState<'list' | 'new' | 'active'>('list')
  const [sessionTitle, setSessionTitle] = useState('')
  const [wineCount, setWineCount] = useState(3)
  const [activeSession, setActiveSession] = useState<any>(null)
  const [currentWine, setCurrentWine] = useState(1)
  const [completedWines, setCompletedWines] = useState<number[]>([])

  useEffect(() => { loadSessions().catch(() => setError(t.common.error)) }, [user.id])

  const loadSessions = async () => {
    const { data, error } = await supabase.from('blind_sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    if (error) setError(t.common.error)
    else if (data) setSessions(data)
  }

  const createSession = async () => {
    if (createLock.current) return
    createLock.current = true
    setBusy(true)
    setError('')
    try {
    const { data, error } = await supabase.from('blind_sessions').insert({
      user_id: user.id,
      title: sessionTitle || (lang === 'ja' ? 'ブラインドセッション' : '블라인드 세션'),
      wine_count: wineCount,
      status: 'active',
    }).select().single()
    if (!error && data) {
      setActiveSession(data)
      setCurrentWine(1)
      setCompletedWines([])
      setView('active')
      await loadSessions()
    } else setError(t.common.error)
    } catch { setError(t.common.error) } finally { createLock.current = false; setBusy(false) }
  }

  const resumeSession = async (session: any) => {
    setError('')
    const { data, error } = await supabase.from('tastings').select('blind_wine_number')
      .eq('user_id', user.id).eq('blind_session_id', session.id)
    if (error) { setError(t.common.error); return }
    const done = [...new Set((data || []).map(row => row.blind_wine_number as number))]
    setActiveSession(session)
    setCompletedWines(done)
    setCurrentWine(Array.from({ length: session.wine_count }, (_, i) => i + 1).find(n => !done.includes(n)) || 1)
    setView('active')
  }
  const completeSession = async () => {
    setBusy(true)
    try {
      const { error } = await supabase.from('blind_sessions').update({ status: 'completed' }).eq('id', activeSession.id).eq('user_id', user.id)
      if (error) { setError(t.common.error); return }
      setView('list'); setActiveSession(null); await loadSessions()
    } catch { setError(t.common.error) } finally { setBusy(false) }
  }

  if (view === 'active' && activeSession) {
    return (
      <div>
        {error && <p role="alert" className="card p-3">{error}</p>}
        {/* Session Header */}
        <div className="bg-cave-700 text-white px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">{activeSession.title}</div>
            <div className="text-xs text-gold-500/50">
              {completedWines.length}/{activeSession.wine_count} {lang === 'ja' ? '完了' : '완료'}
            </div>
          </div>
          <button onClick={completeSession} disabled={busy || completedWines.length < activeSession.wine_count} className="text-xs border border-white/30 px-3 py-1 hover:bg-cave-600/40/10">
            {t.blind.complete}
          </button>
        </div>

        {/* Wine Selector */}
        <div className="bg-gradient-to-b from-gold-500 to-gold-600 px-4 py-2 flex gap-2 overflow-x-auto">
          {Array.from({ length: activeSession.wine_count }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              disabled={completedWines.includes(n)}
              onClick={() => setCurrentWine(n)}
              className={`flex-shrink-0 w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                currentWine === n
                  ? 'bg-cave-600/40 text-gold-300'
                  : completedWines.includes(n)
                    ? 'bg-gold-600 text-white'
                    : 'border border-gold-500/30 text-ink hover:bg-cave-500/40'
              }`}
            >
              {completedWines.includes(n) ? '✓' : n}
            </button>
          ))}
        </div>

        {completedWines.length < activeSession.wine_count ? <TastingSheet
          key={`${activeSession.id}-${currentWine}`}
          lang={lang}
          user={user}
          onBack={() => setView('list')}
          onSaved={() => { resumeSession(activeSession).catch(() => setError(t.common.error)) }}
          blindSessionId={activeSession.id}
          blindWineNumber={currentWine}
        /> : <p role="status" className="p-6">{lang === 'ja' ? 'すべてのワインを記録しました。セッションを完了できます。' : '모든 와인을 기록했습니다. 세션을 완료할 수 있습니다.'}</p>}
      </div>
    )
  }

  if (view === 'new') {
    return (
      <div className="max-w-lg mx-auto p-4">
        {error && <p role="alert" className="card p-3">{error}</p>}
        <button onClick={() => setView('list')} className="text-gold-400 text-sm mb-4">← {t.common.back}</button>
        <div className="section-title">{t.blind.newSession}</div>

        <div className="card p-6 space-y-4">
          <div>
            <label className="text-xs tracking-wider uppercase text-gold-700 mb-1 block">{t.blind.sessionTitle}</label>
            <input
              value={sessionTitle}
              onChange={e => setSessionTitle(e.target.value)}
              placeholder={lang === 'ja' ? '例: 2024年 ボルドー比較' : '예: 2024년 보르도 비교'}
              className="input-field"
            />
          </div>
          <div>
            <label className="text-xs tracking-wider uppercase text-gold-700 mb-2 block">
              {t.blind.wineCount}: {wineCount}
            </label>
            <div className="flex flex-wrap gap-2">
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button
                  key={n}
                  onClick={() => setWineCount(n)}
                  className={`w-9 h-9 text-sm border transition-colors ${
                    wineCount === n ? 'bg-gradient-to-b from-gold-500 to-gold-600 text-white border-gold-600' : 'border-cave-400/30 text-cave-100 hover:border-gold-500/40'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button onClick={createSession} disabled={busy} className="btn-primary w-full">{t.blind.start}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="section-title mb-0">{t.blind.title}</div>
        <button onClick={() => setView('new')} className="btn-primary py-2 px-4 text-xs">
          + {t.blind.newSession}
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-16 text-cave-100">
          <div className="text-4xl mb-3">🎭</div>
          <div className="text-sm">{lang === 'ja' ? 'セッションがありません' : '세션이 없습니다'}</div>
          <button onClick={() => setView('new')} className="mt-4 btn-secondary py-2 px-6 text-xs">
            {t.blind.newSession}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <div key={s.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-sm">{s.title}</div>
                  <div className="text-xs text-cave-100 mt-0.5">
                    {s.wine_count}{lang === 'ja' ? '本' : '병'} ·{' '}
                    {new Date(s.created_at).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'ko-KR')}
                  </div>
                </div>
                <div className={`text-xs px-2 py-0.5 ${
                  s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-cave-600/50 text-cave-100'
                }`}>
                  {s.status === 'active'
                    ? (lang === 'ja' ? '進行中' : '진행 중')
                    : (lang === 'ja' ? '完了' : '완료')
                  }
                </div>
              </div>
              {s.status === 'active' && (
                <button
                  onClick={() => { resumeSession(s).catch(() => setError(t.common.error)) }}
                  className="mt-3 btn-secondary w-full py-2 text-xs"
                >
                  {lang === 'ja' ? '続きから' : '이어서 하기'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
