import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vinoteca',
  description: 'ワインテイスティング記録アプリ',
  manifest: '/manifest.json',
  themeColor: '#0A0A0F',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Noto+Sans+JP:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-parchment" style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>
        {children}
      </body>
    </html>
  )
}
