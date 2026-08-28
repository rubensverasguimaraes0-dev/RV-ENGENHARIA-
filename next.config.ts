import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['exceljs'],
  // A logo entra dentro do xlsx, entao o arquivo precisa viajar junto com a
  // funcao de servidor — o tracer nao o encontra sozinho, porque o caminho e
  // montado em tempo de execucao.
  outputFileTracingIncludes: {
    '/api/**': ['./public/logo-rv.png'],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}

export default nextConfig
