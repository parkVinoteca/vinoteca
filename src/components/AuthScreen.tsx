'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { translations, Language } from '@/i18n'

interface Props {
  lang: Language
  onLangChange: (lang: Language) => void
}

export default function AuthScreen({ lang, onLangChange }: Props) {
  const t = translations[lang]
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleAuth = async () => {
    setLoading(true)
    setMessage('')
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setMessage(error.message)
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) setMessage(error.message)
        else setMessage(lang === 'ja' ? '確認メールを送信しました。メールをご確認ください。' : '확인 이메일을 발송했습니다.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      })
      if (error) setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-parchment flex flex-col">
      {/* Header */}
      <div className="bg-wine-800 px-4 py-3 flex justify-between items-center">
        <div className="font-serif text-xl text-white tracking-wider">Vinoteca</div>
        <button
          onClick={() => onLangChange(lang === 'ja' ? 'ko' : 'ja')}
          className="text-xs border border-white/30 text-white px-2 py-1 rounded-sm"
        >
          {lang === 'ja' ? '🇰🇷 한국어' : '🇯🇵 日本語'}
        </button>
      </div>

      {/* Hero */}
      <div className="bg-wine-900 text-white text-center py-16 px-6">
        <div className="font-serif text-5xl mb-3 tracking-wide">Vinoteca</div>
        <div className="text-wine-200 text-sm tracking-widest uppercase">{t.app.tagline}</div>
        <div className="mt-6 text-wine-300 text-xs">
          {lang === 'ja'
            ? 'あなたのワイン体験を記録・分析・共有'
            : '당신의 와인 경험을 기록·분석·공유'}
        </div>
      </div>

      {/* Auth Form */}
      <div className="flex-1 p-6 max-w-md mx-auto w-full">
        <div className="card p-6 mt-6">
          {/* Mode Toggle */}
          <div className="flex border border-gray-200 mb-6">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 text-xs tracking-widest uppercase transition-colors ${
                mode === 'signin' ? 'bg-wine-800 text-white' : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              {lang === 'ja' ? 'ログイン' : '로그인'}
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 text-xs tracking-widest uppercase transition-colors ${
                mode === 'signup' ? 'bg-wine-800 text-white' : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              {lang === 'ja' ? '新規登録' : '회원가입'}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs tracking-widest uppercase text-wine-700 mb-1 block">
                {lang === 'ja' ? 'メールアドレス' : '이메일'}
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="text-xs tracking-widest uppercase text-wine-700 mb-1 block">
                {lang === 'ja' ? 'パスワード' : '비밀번호'}
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleAuth()}
              />
            </div>

            {message && (
              <div className="text-xs text-wine-700 bg-wine-50 p-3 border border-wine-200">
                {message}
              </div>
            )}

            <button
              onClick={handleAuth}
              disabled={loading || !email || !password}
              className="btn-primary w-full"
            >
              {loading
                ? t.common.loading
                : mode === 'signin'
                  ? (lang === 'ja' ? 'ログイン' : '로그인')
                  : (lang === 'ja' ? '登録する' : '가입하기')
              }
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-[10px] text-gray-400 tracking-widest uppercase">
                {lang === 'ja' ? 'または' : '또는'}
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Google Login */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 border border-gray-300 bg-white py-3 px-6 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              {lang === 'ja' ? 'Googleでログイン' : 'Google로 로그인'}
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          {[
            { icon: '📝', ja: 'テイスティング記録', ko: '테이스팅 기록' },
            { icon: '🎭', ja: 'ブラインドモード', ko: '블라인드 모드' },
            { icon: '📚', ja: 'ワインセラー', ko: '와인 저장고' },
            { icon: '🤖', ja: 'AI取向分析', ko: 'AI 취향 분석' },
          ].map((f, i) => (
            <div key={i} className="card p-3 text-center">
              <div className="text-2xl mb-1">{f.icon}</div>
              <div className="text-xs text-gray-500">{lang === 'ja' ? f.ja : f.ko}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
