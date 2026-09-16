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
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleAuth = async () => {
    if (loading) return
    setLoading(true)
    setMessage('')
    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        setMessage(lang === 'ja' ? '登録されている場合、再設定メールが届きます。' : '등록된 이메일이면 재설정 메일이 발송됩니다.')
      } else if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setMessage(lang === 'ja' ? 'ログインまたは登録に失敗しました。入力内容をご確認ください。' : '로그인 또는 가입에 실패했습니다. 입력 내용을 확인해주세요.')
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) setMessage(lang === 'ja' ? 'ログインまたは登録に失敗しました。入力内容をご確認ください。' : '로그인 또는 가입에 실패했습니다. 입력 내용을 확인해주세요.')
        else setMessage(lang === 'ja' ? '確認メールを送信しました。メールをご確認ください。' : '확인 이메일을 발송했습니다.')
      }
    } catch {
      setMessage(lang === 'ja' ? '接続できませんでした。再度お試しください。' : '연결하지 못했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    if (loading) return
    setLoading(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      })
      if (error) setMessage(lang === 'ja' ? 'ログインまたは登録に失敗しました。入力内容をご確認ください。' : '로그인 또는 가입에 실패했습니다. 입력 내용을 확인해주세요.')
    } catch {
      setMessage(lang === 'ja' ? '接続できませんでした。再度お試しください。' : '연결하지 못했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-parchment flex flex-col relative overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-20 w-96 h-96 rounded-full bg-gold-700/10 blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-80 h-80 rounded-full bg-gold-600/5 blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative px-5 py-4 flex justify-between items-center border-b border-gold-900/20">
        <div className="font-serif italic text-xl text-gold-300 tracking-wider">Vinoteca</div>
        <button
          onClick={() => onLangChange(lang === 'ja' ? 'ko' : 'ja')}
          className="text-xs border border-gold-700/40 text-gold-200 px-3 py-1.5 rounded-full hover:bg-gold-900/20 hover:border-gold-500/60 transition-colors"
        >
          {lang === 'ja' ? '🇰🇷 한국어' : '🇯🇵 日本語'}
        </button>
      </div>

      {/* Hero — Cave Note style */}
      <div className="relative text-center pt-16 pb-14 px-6">
        <div className="inline-block mb-6">
          <div className="text-[10px] tracking-[0.5em] text-gold-500/70 uppercase mb-3">Vinoteca</div>
          <div className="font-serif italic text-5xl md:text-6xl text-gold-200 leading-tight text-gold-glow">
            {lang === 'ja' ? (
              <>飲んだ一本を<br />忘れない</>
            ) : (
              <>마신 한 병을<br />기억하다</>
            )}
          </div>
        </div>
        <div className="text-cave-100 text-xs md:text-sm tracking-wide max-w-xs mx-auto leading-relaxed">
          {lang === 'ja'
            ? 'ラベルを撮るだけで、造り手・銘柄・ヴィンテージまでAIが読み取る'
            : '라벨을 찍기만 하면 AI가 생산자·품종·빈티지까지 읽어줍니다'}
        </div>
      </div>

      {/* Auth Form */}
      <div className="relative flex-1 px-6 pb-10 max-w-md mx-auto w-full">
        <div className="card p-6">
          {/* Mode Toggle */}
          <div className="flex border border-gold-900/30 rounded-full p-1 mb-6 bg-cave-700/50">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 text-xs tracking-widest uppercase rounded-full transition-all ${
                mode === 'signin'
                  ? 'bg-gradient-to-b from-gold-500 to-gold-600 text-cave-900 font-medium'
                  : 'text-cave-100 hover:text-gold-200'
              }`}
            >
              {lang === 'ja' ? 'ログイン' : '로그인'}
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 text-xs tracking-widest uppercase rounded-full transition-all ${
                mode === 'signup'
                  ? 'bg-gradient-to-b from-gold-500 to-gold-600 text-cave-900 font-medium'
                  : 'text-cave-100 hover:text-gold-200'
              }`}
            >
              {lang === 'ja' ? '新規登録' : '회원가입'}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="auth-email" className="text-[10px] tracking-[0.2em] uppercase text-gold-500 mb-1 block">
                {lang === 'ja' ? 'メールアドレス' : '이메일'}
              </label>
              <input
                id="auth-email"
                autoComplete="email"
                required
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field"
                placeholder="email@example.com"
              />
            </div>
            {mode !== 'reset' && <div>
              <label htmlFor="auth-password" className="text-[10px] tracking-[0.2em] uppercase text-gold-500 mb-1 block">
                {lang === 'ja' ? 'パスワード' : '비밀번호'}
              </label>
              <input
                id="auth-password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && email && password && !loading && handleAuth()}
              />
            </div>}

            {message && (
              <div role="status" aria-live="polite" className="text-xs text-gold-200 bg-gold-900/20 p-3 border border-gold-700/30 rounded">
                {message}
              </div>
            )}

            <button
              onClick={handleAuth}
              disabled={loading || !email || (mode !== 'reset' && !password)}
              className="btn-primary w-full"
            >
              {loading
                ? t.common.loading
                : mode === 'reset' ? (lang === 'ja' ? '再設定メールを送信' : '재설정 이메일 보내기') : mode === 'signin'
                  ? (lang === 'ja' ? 'ログイン' : '로그인')
                  : (lang === 'ja' ? '登録する' : '가입하기')
              }
            </button>

            <button type="button" className="text-xs underline text-gold-300" onClick={() => { setMode(mode === 'reset' ? 'signin' : 'reset'); setMessage('') }}>
              {mode === 'reset' ? (lang === 'ja' ? 'ログインに戻る' : '로그인으로 돌아가기') : (lang === 'ja' ? 'パスワードを忘れた方' : '비밀번호를 잊으셨나요?')}
            </button>
            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-gold-900/30" />
              <span className="text-[10px] text-cave-100 tracking-widest uppercase">
                {lang === 'ja' ? 'または' : '또는'}
              </span>
              <div className="flex-1 h-px bg-gold-900/30" />
            </div>

            {/* Google Login */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 border border-cave-300/30 bg-cave-600/40 py-3 px-6 text-sm font-medium text-ink hover:bg-cave-500/40 hover:border-gold-500/40 transition-colors disabled:opacity-50 rounded"
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
            <div key={i} className="card p-4 text-center">
              <div className="text-2xl mb-1.5">{f.icon}</div>
              <div className="text-xs text-cave-100">{lang === 'ja' ? f.ja : f.ko}</div>
            </div>
          ))}
        </div>

        {/* Footer tagline like Cave Note */}
        <div className="mt-10 text-center">
          <div className="font-serif italic text-gold-500/60 text-sm tracking-widest">CAVE · VINOTECA</div>
          <div className="text-[9px] text-cave-200 tracking-[0.2em] uppercase mt-1">
            {lang === 'ja' ? 'ワイン記録アプリ・無料' : '와인 기록 앱 · 무료'}
          </div>
        </div>
      </div>
    </div>
  )
}
