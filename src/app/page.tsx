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
        <div className="text-4xl font-serif text-wine-800 mb-2">Vinoteca</div>
        <div className="text-xs tracking-widest text-gray-400">{t.common.loading}</div>
      </div>
    </div>
  )

  if (!user) return <AuthScreen lang={lang} onLangChange={setLang} />

  return (
    <div className="min-h-screen bg-parchment flex flex-col">
      {/* Header */}
      <header className="bg-wine-800 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <button onClick={() => setScreen('home')} className="font-serif text-xl tracking-wider">
          Vinoteca
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang(lang === 'ja' ? 'ko' : 'ja')}
            className="text-xs border border-white/30 px-2 py-1 rounded-sm hover:bg-white/10 transition-colors"
          >
            {lang === 'ja' ? '🇰🇷 한국어' : '🇯🇵 日本語'}
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs text-white/60 hover:text-white transition-colors"
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
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex z-50 shadow-lg">
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
              screen === item.id ? 'text-wine-800' : 'text-gray-400'
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
