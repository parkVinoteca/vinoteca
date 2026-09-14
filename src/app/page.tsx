'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { translations, Language } from '@/i18n'
import HomeScreen from '@/components/HomeScreen'
import TastingSheet from '@/components/TastingSheet'
import BlindMode from '@/components/BlindMode'
import MyCellar from '@/components/MyCellar'
import AIRecommend from '@/components/AIRecommend'
import AuthScreen from '@/components/AuthScreen'
import type { User } from '@supabase/supabase-js'

export type Screen = 'home' | 'tasting' | 'blind' | 'cellar' | 'recommend'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState<Screen>('home')
  const [lang, setLang] = useState<Language>('ja')
  const t = translations[lang]

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-parchment">
      <div className="text-center">
        <div className="text-5xl font-serif italic text-gold-400 mb-2 text-gold-glow tracking-wide">Vinoteca</div>
        <div className="text-[10px] tracking-[0.3em] text-cave-200 uppercase">{t.common.loading}</div>
      </div>
    </div>
  )

  if (!user) return <AuthScreen lang={lang} onLangChange={setLang} />

  return (
    <div className="min-h-screen bg-parchment flex flex-col">
      {/* Header */}
      <header className="bg-cave-700/90 backdrop-blur-md border-b border-gold-900/30 text-ink px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <button onClick={() => setScreen('home')} className="font-serif italic text-xl tracking-wider text-gold-300">
          Vinoteca
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang(lang === 'ja' ? 'ko' : 'ja')}
            className="text-xs border border-gold-700/40 text-gold-200 px-2 py-1 rounded-full hover:bg-gold-900/20 hover:border-gold-500/60 transition-colors"
          >
            {lang === 'ja' ? '🇰🇷 한국어' : '🇯🇵 日本語'}
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs text-cave-100 hover:text-gold-300 transition-colors"
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20">
        {screen === 'home' && <HomeScreen lang={lang} user={user} onNavigate={setScreen} />}
        {screen === 'tasting' && <TastingSheet lang={lang} user={user} onBack={() => setScreen('home')} />}
        {screen === 'blind' && <BlindMode lang={lang} user={user} onBack={() => setScreen('home')} />}
        {screen === 'cellar' && <MyCellar lang={lang} user={user} onBack={() => setScreen('home')} />}
        {screen === 'recommend' && <AIRecommend lang={lang} user={user} onBack={() => setScreen('home')} />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-cave-700/95 backdrop-blur-md border-t border-gold-900/30 flex z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
        {([
          { id: 'home', icon: '🏠', label: t.nav.home },
          { id: 'tasting', icon: '📝', label: t.nav.tasting },
          { id: 'blind', icon: '🎭', label: t.nav.blind },
          { id: 'cellar', icon: '📚', label: t.nav.cellar },
          { id: 'recommend', icon: '🤖', label: t.nav.recommend },
        ] as const).map(item => (
          <button
            key={item.id}
            onClick={() => setScreen(item.id)}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors ${
              screen === item.id ? 'text-gold-400' : 'text-cave-200'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-[9px] tracking-wide">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
