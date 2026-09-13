import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vinoteca',
  description: 'ワインテイスティング記録アプリ',
  manifest: '/manifest.json',
  themeColor: '#7a1c3a',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-parchment">
        {children}
      </body>
    </html>
  )
}
