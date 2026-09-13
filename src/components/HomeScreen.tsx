'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { translations, Language } from '@/i18n'
import { Screen } from '@/app/page'
import type { User } from '@supabase/supabase-js'

interface Props {
  lang: Language
  user: User
  onNavigate: (screen: Screen) => void
}

export default function HomeScreen({ lang, user, onNavigate }: Props) {
  const t = translations[lang]
  const [stats, setStats] = useState({ total: 0, avgScore: 0, topCountry: '-', recentWine: '-' })
  const [recentTastings, setRecentTastings] = useState<any[]>([])

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    const { data } = await supabase
      .from('tastings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

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
      setRecentTastings(all)
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Welcome */}
      <div className="py-6">
        <div className="text-xs text-gray-400 tracking-widest uppercase mb-1">
          {lang === 'ja' ? 'ようこそ' : '환영합니다'}
        </div>
        <div className="font-serif text-2xl text-wine-800">Vinoteca</div>
        <div className="text-xs text-gray-400 mt-1">{user.email}</div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: lang === 'ja' ? '記録数' : '기록 수', value: `${stats.total}本`, icon: '🍷' },
          { label: lang === 'ja' ? '平均スコア' : '평균 점수', value: stats.avgScore || '-', icon: '⭐' },
          { label: lang === 'ja' ? 'よく飲む国' : '자주 마시는 나라', value: stats.topCountry, icon: '🌍' },
          { label: lang === 'ja' ? '最近のワイン' : '최근 와인', value: stats.recentWine.length > 10 ? stats.recentWine.slice(0, 10) + '...' : stats.recentWine, icon: '📝' },
        ].map((s, i) => (
          <div key={i} className="card p-4">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-xs text-gray-400 mb-0.5">{s.label}</div>
            <div className="font-medium text-wine-800 text-sm">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <div className="section-title">{lang === 'ja' ? 'クイックアクション' : '빠른 실행'}</div>
        <div className="space-y-2">
          <button
            onClick={() => onNavigate('tasting')}
            className="w-full card p-4 flex items-center gap-4 hover:bg-wine-50 transition-colors text-left"
          >
            <span className="text-2xl">📝</span>
            <div>
              <div className="font-medium text-sm text-wine-800">{t.tasting.normal}</div>
              <div className="text-xs text-gray-400">{lang === 'ja' ? 'ラベルを撮影して記録' : '라벨을 찍어 기록'}</div>
            </div>
            <span className="ml-auto text-gray-300">›</span>
          </button>
          <button
            onClick={() => onNavigate('blind')}
            className="w-full card p-4 flex items-center gap-4 hover:bg-wine-50 transition-colors text-left"
          >
            <span className="text-2xl">🎭</span>
            <div>
              <div className="font-medium text-sm text-wine-800">{t.tasting.blind}</div>
              <div className="text-xs text-gray-400">{lang === 'ja' ? 'グループセッションを開始' : '그룹 세션 시작'}</div>
            </div>
            <span className="ml-auto text-gray-300">›</span>
          </button>
          <button
            onClick={() => onNavigate('recommend')}
            className="w-full card p-4 flex items-center gap-4 hover:bg-wine-50 transition-colors text-left"
          >
            <span className="text-2xl">🤖</span>
            <div>
              <div className="font-medium text-sm text-wine-800">{t.recommend.title}</div>
              <div className="text-xs text-gray-400">{lang === 'ja' ? '写真でワインを解析' : '사진으로 와인 분석'}</div>
            </div>
            <span className="ml-auto text-gray-300">›</span>
          </button>
        </div>
      </div>

      {/* Recent Tastings */}
      {recentTastings.length > 0 && (
        <div>
          <div className="section-title flex items-center justify-between">
            <span>{lang === 'ja' ? '最近の記録' : '최근 기록'}</span>
            <button onClick={() => onNavigate('cellar')} className="text-wine-600 text-xs normal-case tracking-normal">
              {lang === 'ja' ? 'すべて見る →' : '전체 보기 →'}
            </button>
          </div>
          <div className="space-y-2">
            {recentTastings.slice(0, 3).map(tasting => (
              <div key={tasting.id} className="card p-3 flex items-center gap-3">
                {tasting.label_image_url ? (
                  <img src={tasting.label_image_url} alt="" className="w-10 h-14 object-cover" />
                ) : (
                  <div className="w-10 h-14 bg-wine-100 flex items-center justify-center text-wine-400 text-xl">🍷</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-ink truncate">
                    {tasting.wine_name || tasting.producer || (lang === 'ja' ? '名称未設定' : '이름 없음')}
                  </div>
                  <div className="text-xs text-gray-400">
                    {tasting.vintage && `${tasting.vintage} · `}
                    {tasting.country || tasting.region || ''}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(tasting.created_at).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'ko-KR')}
                  </div>
                </div>
                {tasting.score && (
                  <div className="text-wine-800 font-serif text-xl font-bold">{tasting.score}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {recentTastings.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">🍷</div>
          <div className="text-sm">{lang === 'ja' ? 'まだ記録がありません' : '아직 기록이 없습니다'}</div>
          <div className="text-xs mt-1">{lang === 'ja' ? '最初のテイスティングを記録しましょう' : '첫 번째 테이스팅을 기록해보세요'}</div>
        </div>
      )}
    </div>
  )
}
