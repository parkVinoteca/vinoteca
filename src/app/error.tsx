'use client'
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <main className="min-h-screen grid place-items-center p-6"><div role="alert" className="max-w-md"><h1 className="font-serif text-3xl text-gold-300">Vinoteca</h1><p className="my-4">画面を表示できませんでした。再度お試しください。</p><p lang="ko" className="my-4">화면을 표시하지 못했습니다. 다시 시도해주세요.</p><button className="btn-primary" onClick={reset}>再試行 · 다시 시도</button></div></main>
}
