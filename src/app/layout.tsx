import type { Metadata, Viewport } from 'next'
import './globals.css'
import { RegistrarServiceWorker } from '@/components/registrar-sw'

export const metadata: Metadata = {
  title: 'RV Engenharia — Gestão',
  description: 'Gestão de obras civis, energia solar e locação de equipamentos',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'RV Engenharia', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
}

export const viewport: Viewport = {
  themeColor: '#0b4f8a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  )
}
