import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans } from 'next/font/google'
import './globals.css'

/**
 * IBM Plex Sans: desenhada para interface tecnica, com numeral tabular de
 * verdade — o que importa numa tela cheia de coluna de dinheiro — e acentuacao
 * completa do portugues. Servida pelo proprio site (next/font), sem chamada a
 * terceiros e sem o pulo de layout de quem carrega fonte por CDN.
 */
const fonte = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--fonte-app',
})
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
    <html lang="pt-BR" className={fonte.variable}>
      <body>
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  )
}
