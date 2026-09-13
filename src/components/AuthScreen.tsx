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
