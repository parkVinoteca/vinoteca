'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { translations, Language } from '@/i18n'
import TastingSheet from './TastingSheet'
import type { User } from '@supabase/supabase-js'

interface Props { lang: Language; user: User; onBack: () => void }

export default function BlindMode({ lang, user, onBack }: Props) {
  const t = translations[lang]
  const [sessions, setSessions] = useState<any[]>([])
  const [view, setView] = useState<'list' | 'new' | 'active'>('list')
  const [sessionTitle, setSessionTitle] = useState('')
  const [wineCount, setWineCount] = useState(3)
  const [activeSession, setActiveSession] = useState<any>(null)
  const [currentWine, setCurrentWine] = useState(1)
  const [completedWines, setCompletedWines] = useState<number[]>([])

  useEffect(() => { loadSessions() }, [])

  const loadSessions = async () => {
    const { data } = await supabase.from('blind_sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    if (data) setSessions(data)
  }

  const createSession = async () => {
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
      loadSessions()
    }
  }

  const completeSession = async () => {
    await supabase.from('blind_sessions').update({ status: 'completed' }).eq('id', activeSession.id)
    setView('list')
    setActiveSession(null)
    loadSessions()
  }

  if (view === 'active' && activeSession) {
    return (
      <div>
        {/* Session Header */}
        <div className="bg-wine-900 text-white px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">{activeSession.title}</div>
            <div className="text-xs text-wine-300">
              {completedWines.length}/{activeSession.wine_count} {lang === 'ja' ? '完了' : '완료'}
            </div>
          </div>
          <button onClick={completeSession} className="text-xs border border-white/30 px-3 py-1 hover:bg-white/10">
            {t.blind.complete}
          </button>
        </div>

        {/* Wine Selector */}
        <div className="bg-wine-800 px-4 py-2 flex gap-2 overflow-x-auto">
          {Array.from({ length: activeSession.wine_count }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              onClick={() => setCurrentWine(n)}
              className={`flex-shrink-0 w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                currentWine === n
                  ? 'bg-white text-wine-800'
                  : completedWines.includes(n)
                    ? 'bg-wine-600 text-white'
                    : 'border border-white/30 text-white hover:bg-wine-700'
              }`}
            >
              {completedWines.includes(n) ? '✓' : n}
            </button>
          ))}
        </div>

        <TastingSheet
          lang={lang}
          user={user}
          onBack={() => {
            setCompletedWines(prev => [...prev, currentWine])
            if (currentWine < activeSession.wine_count) setCurrentWine(currentWine + 1)
          }}
          blindSessionId={activeSession.id}
          blindWineNumber={currentWine}
        />
      </div>
    )
  }

  if (view === 'new') {
    return (
      <div className="max-w-lg mx-auto p-4">
        <button onClick={() => setView('list')} className="text-wine-700 text-sm mb-4">← {t.common.back}</button>
        <div className="section-title">{t.blind.newSession}</div>

        <div className="card p-6 space-y-4">
          <div>
            <label className="text-[10px] tracking-widest uppercase text-wine-700 mb-1 block">{t.blind.sessionTitle}</label>
            <input
              value={sessionTitle}
              onChange={e => setSessionTitle(e.target.value)}
              placeholder={lang === 'ja' ? '例: 2024年 ボルドー比較' : '예: 2024년 보르도 비교'}
              className="input-field"
            />
          </div>
          <div>
            <label className="text-[10px] tracking-widest uppercase text-wine-700 mb-2 block">
              {t.blind.wineCount}: {wineCount}
            </label>
            <div className="flex gap-2">
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button
                  key={n}
                  onClick={() => setWineCount(n)}
                  className={`w-9 h-9 text-sm border transition-colors ${
                    wineCount === n ? 'bg-wine-800 text-white border-wine-800' : 'border-gray-200 text-gray-500 hover:border-wine-400'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button onClick={createSession} className="btn-primary w-full">{t.blind.start}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="section-title mb-0">{t.blind.title}</div>
        <button onClick={() => setView('new')} className="btn-primary py-2 px-4 text-[10px]">
          + {t.blind.newSession}
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
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
                  <div className="text-xs text-gray-400 mt-0.5">
                    {s.wine_count}{lang === 'ja' ? '本' : '병'} ·{' '}
                    {new Date(s.created_at).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'ko-KR')}
                  </div>
                </div>
                <div className={`text-xs px-2 py-0.5 ${
                  s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {s.status === 'active'
                    ? (lang === 'ja' ? '進行中' : '진행 중')
                    : (lang === 'ja' ? '完了' : '완료')
                  }
                </div>
              </div>
              {s.status === 'active' && (
                <button
                  onClick={() => { setActiveSession(s); setCurrentWine(1); setCompletedWines([]); setView('active') }}
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
