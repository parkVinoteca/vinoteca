'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Language } from '@/i18n'
export default function RecoverPassword({ lang, onDone }: { lang: Language; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <main className="min-h-screen grid place-items-center p-6"><form className="card p-6 w-full max-w-md space-y-4" onSubmit={async e => {
    e.preventDefault(); if (busy || password.length < 8 || password !== confirmation) return
    setBusy(true); setError('')
    try { const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; onDone() }
    catch { setError(lang === 'ja' ? '更新できませんでした。新しい再設定メールでお試しください。' : '변경하지 못했습니다. 새 재설정 이메일로 시도해주세요.') }
    finally { setBusy(false) }
  }}><h1 className="text-xl text-gold-300">{lang === 'ja' ? 'パスワードを再設定' : '비밀번호 재설정'}</h1>
    <label className="block">{lang === 'ja' ? '新しいパスワード（8文字以上）' : '새 비밀번호 (8자 이상)'}<input className="input-field" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /></label>
    <label className="block">{lang === 'ja' ? '確認用パスワード' : '비밀번호 확인'}<input className="input-field" type="password" autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    <button className="btn-primary" disabled={busy || password.length < 8 || password !== confirmation}>{lang === 'ja' ? '保存' : '저장'}</button>
  </form></main>
}
