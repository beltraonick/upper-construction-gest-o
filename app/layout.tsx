import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Orbit',
  description: 'Orbit — Plataforma de gestão de equipes',
  manifest: '/manifest.json',
  applicationName: 'Orbit',
  appleWebApp: {
    capable: true,
    title: 'Orbit',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [{ url: '/icon.png', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '1080x1080', type: 'image/png' }],
    shortcut: '/icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#111111',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="apple-mobile-web-app-title" content="Orbit" />
        <meta name="application-name" content="Orbit" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="shortcut icon" href="/icon.png" type="image/png" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
