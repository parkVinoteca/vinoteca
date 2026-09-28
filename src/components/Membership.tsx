import UsageAlerts from './UsageAlerts'
import type { Language } from '@/i18n'

export default function Membership({ lang }: { lang: Language }) {
  const ja = lang === 'ja'
  return <section className="max-w-lg mx-auto p-4 space-y-5">
    <UsageAlerts lang={lang}/>
    <h1 className="section-title">{ja ? 'マイページ' : '마이페이지'}</h1>
    <div className="card p-4">
      <h2 className="font-medium">{ja ? 'ベータテスト中' : '베타 테스트 중'}</h2>
      <p className="mt-2 text-sm">{ja ? '現在は全員が有料プラン相当の機能を無料で試せます。ベータ期間中はAIの利用回数を制限しません。' : '현재 모든 사용자가 유료 플랜 수준의 기능을 무료로 체험할 수 있습니다. 베타 기간에는 AI 이용 횟수를 제한하지 않습니다.'}</p>
    </div>
    <h2 className="font-medium">{ja ? '正式公開時のプラン（予定）' : '정식 출시 플랜 (예정)'}</h2>
    <table className="w-full text-sm text-left"><thead><tr><th className="py-3">{ja ? '機能' : '기능'}</th><th>{ja ? '無料' : '무료'}</th><th>{ja ? '有料' : '유료'}</th></tr></thead><tbody>
      {[
        [ja ? '写真の保存・手入力' : '사진 저장·직접 입력', ja ? '利用可' : '가능', ja ? '利用可' : '가능'],
        [ja ? 'テイスティングAI' : '테이스팅 AI', '—', ja ? '月50回' : '월 50회'],
        [ja ? 'AIソムリエ' : 'AI 소믈리에', ja ? '月3回' : '월 3회', ja ? '月20回' : '월 20회'],
      ].map(row => <tr key={row[0]} className="border-t border-cave-400">{row.map((cell,i) => i === 0 ? <th scope="row" key={i} className="py-3 font-normal">{cell}</th> : <td key={i}>{cell}</td>)}</tr>)}
    </tbody></table>
    <p className="text-xs text-cave-100">{ja ? '毎月1日（日本時間）に利用枠が更新されます。AIソムリエは評価付き記録3本から利用できます。解析開始後の失敗も回数に含まれます。' : '매월 1일(일본 시간)에 이용 한도가 갱신됩니다. AI 소믈리에는 평점 기록 3병부터 이용할 수 있습니다. 분석 시작 후 실패도 횟수에 포함됩니다.'}</p>
    <div className="card p-4"><h2 className="font-medium">{ja ? 'お支払い管理' : '결제 관리'}</h2><p className="mt-2 text-sm">{ja ? 'ベータ期間中の請求はありません。契約・変更・解約の機能は正式公開時にご案内します。' : '베타 기간에는 청구되지 않습니다. 구독·변경·해지는 정식 출시 시 안내합니다.'}</p></div>
  </section>
}
