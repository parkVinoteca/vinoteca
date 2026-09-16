'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { translations, Language } from '@/i18n'
import { Screen } from '@/app/page'
import { resolveLabelImage } from '@/lib/labelImages'
import type { User } from '@supabase/supabase-js'

interface Props {
  lang: Language
  user: User
  onNavigate: (screen: Screen) => void
}

export default function HomeScreen({ lang, user, onNavigate }: Props) {
  const t = translations[lang]
  const [stats, setStats] = useState({ total: 0, avgScore: 0, topCountry: '-', recentWine: '-' })
  const [error, setError] = useState('')
  const [recentTastings, setRecentTastings] = useState<any[]>([])

  useEffect(() => {
    loadData().catch(() => setError(t.common.error))
  }, [user])

  const loadData = async () => {
    setError('')
    const data: any[] = []
    for (let from = 0; ; from += 500) {
      const { data: page, error } = await supabase.from('tastings')
        .select('id, wine_name, producer, country, score, created_at, wine_type, vintage, label_image_url')
        .eq('user_id', user.id).order('created_at', { ascending: false }).order('id').range(from, from + 499)
      if (error) { setError(t.common.error); return }
      data.push(...(page || []))
      if (!page || page.length < 500) break
    }

    if (data && data.length > 0) {
      const all = data
      const withScore = all.filter(d => d.score)
      const avgScore = withScore.length > 0
        ? Math.round(withScore.reduce((s, d) => s + d.score, 0) / withScore.length * 10) / 10
        : 0

      const countryCounts: Record<string, number> = {}
      all.forEach(d => { if (d.country) countryCounts[d.country] = (countryCounts[d.country] || 0) + 1 })
      const topCountry = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'

      setStats({
        total: all.length,
        avgScore,
        topCountry,
        recentWine: all[0]?.wine_name || all[0]?.producer || '-',
      })
      setRecentTastings(await Promise.all(all.slice(0, 5).map(async row => ({ ...row, image_url: await resolveLabelImage(row.label_image_url, user.id) }))))
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      {error && <p role="alert" className="card p-3">{error}</p>}
      {/* Welcome */}
      <div className="py-6">
        <div className="text-xs text-cave-100 tracking-widest uppercase mb-1">
          {lang === 'ja' ? 'ようこそ' : '환영합니다'}
        </div>
        <div className="font-serif text-2xl text-gold-300">Vinoteca</div>
        <div className="text-xs text-cave-100 mt-1">{user.email}</div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: lang === 'ja' ? '記録数' : '기록 수', value: `${stats.total}${lang === 'ja' ? '本' : '병'}`, icon: '🍷' },
          { label: lang === 'ja' ? '平均スコア' : '평균 점수', value: stats.avgScore || '-', icon: '⭐' },
          { label: lang === 'ja' ? 'よく飲む国' : '자주 마시는 나라', value: stats.topCountry, icon: '🌍' },
          { label: lang === 'ja' ? '最近のワイン' : '최근 와인', value: stats.recentWine.length > 10 ? stats.recentWine.slice(0, 10) + '...' : stats.recentWine, icon: '📝' },
        ].map((s, i) => (
          <div key={i} className="card p-4">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-xs text-cave-100 mb-0.5">{s.label}</div>
            <div className="font-medium text-gold-300 text-sm">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <div className="section-title">{lang === 'ja' ? 'クイックアクション' : '빠른 실행'}</div>
        <div className="space-y-2">
          <button
            onClick={() => onNavigate('tasting')}
            className="w-full card p-4 flex items-center gap-4 hover:bg-gold-900/20 transition-colors text-left"
          >
            <span className="text-2xl">📝</span>
            <div>
              <div className="font-medium text-sm text-gold-300">{t.tasting.normal}</div>
              <div className="text-xs text-cave-100">{lang === 'ja' ? 'ラベルを撮影して記録' : '라벨을 찍어 기록'}</div>
            </div>
            <span className="ml-auto text-cave-200">›</span>
          </button>
          <button
            onClick={() => onNavigate('blind')}
            className="w-full card p-4 flex items-center gap-4 hover:bg-gold-900/20 transition-colors text-left"
          >
            <span className="text-2xl">🎭</span>
            <div>
              <div className="font-medium text-sm text-gold-300">{t.tasting.blind}</div>
              <div className="text-xs text-cave-100">{lang === 'ja' ? 'グループセッションを開始' : '그룹 세션 시작'}</div>
            </div>
            <span className="ml-auto text-cave-200">›</span>
          </button>
          <button
            onClick={() => onNavigate('recommend')}
            className="w-full card p-4 flex items-center gap-4 hover:bg-gold-900/20 transition-colors text-left"
          >
            <span className="text-2xl">🤖</span>
            <div>
              <div className="font-medium text-sm text-gold-300">{t.recommend.title}</div>
              <div className="text-xs text-cave-100">{lang === 'ja' ? '写真でワインを解析' : '사진으로 와인 분석'}</div>
            </div>
            <span className="ml-auto text-cave-200">›</span>
          </button>
        </div>
      </div>

      {/* Recent Tastings */}
      {recentTastings.length > 0 && (
        <div>
          <div className="section-title flex items-center justify-between">
            <span>{lang === 'ja' ? '最近の記録' : '최근 기록'}</span>
            <button onClick={() => onNavigate('cellar')} className="text-gold-400 text-xs normal-case tracking-normal">
              {lang === 'ja' ? 'すべて見る →' : '전체 보기 →'}
            </button>
          </div>
          <div className="space-y-2">
            {recentTastings.slice(0, 3).map(tasting => (
              <div key={tasting.id} className="card p-3 flex items-center gap-3">
                {tasting.image_url ? (
                  <img src={tasting.image_url} alt="" className="w-10 h-14 object-cover" />
                ) : (
                  <div className="w-10 h-14 bg-cave-500/40 flex items-center justify-center text-gold-500/60 text-xl">🍷</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-ink truncate">
                    {tasting.wine_name || tasting.producer || (lang === 'ja' ? '名称未設定' : '이름 없음')}
                  </div>
                  <div className="text-xs text-cave-100">
                    {tasting.vintage && `${tasting.vintage} · `}
                    {tasting.country || tasting.region || ''}
                  </div>
                  <div className="text-xs text-cave-100">
                    {new Date(tasting.created_at).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'ko-KR')}
                  </div>
                </div>
                {tasting.score && (
                  <div className="text-gold-300 font-serif text-xl font-bold">{tasting.score}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {recentTastings.length === 0 && (
        <div className="text-center py-12 text-cave-100">
          <div className="text-4xl mb-3">🍷</div>
          <div className="text-sm">{lang === 'ja' ? 'まだ記録がありません' : '아직 기록이 없습니다'}</div>
          <div className="text-xs mt-1">{lang === 'ja' ? '最初のテイスティングを記録しましょう' : '첫 번째 테이스팅을 기록해보세요'}</div>
        </div>
      )}
    </div>
  )
}
