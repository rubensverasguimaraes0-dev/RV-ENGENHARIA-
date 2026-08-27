'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { PerfilUsuario } from '@/lib/domain/tipos'

const MODULOS = [
  { href: '/obras', rotulo: 'Obras Civis', soAdmin: false },
  { href: '/solar', rotulo: 'Energia Solar', soAdmin: true },
  { href: '/locacao', rotulo: 'Locação', soAdmin: true },
  { href: '/cadastros', rotulo: 'Cadastros', soAdmin: true },
]

export function NavegacaoPrincipal({ perfil }: { perfil: PerfilUsuario }) {
  const caminho = usePathname()
  const itens = MODULOS.filter((m) => !m.soAdmin || perfil === 'admin')

  return (
    <nav className="bg-rv-800 overflow-x-auto">
      <ul className="mx-auto max-w-6xl px-1 flex">
        {itens.map((m) => {
          const ativo = caminho === m.href || caminho.startsWith(`${m.href}/`)
          return (
            <li key={m.href}>
              <Link
                href={m.href}
                className={`block px-3 py-2 text-sm font-semibold whitespace-nowrap border-b-[3px] ${
                  ativo
                    ? 'border-white text-white'
                    : 'border-transparent text-rv-100 hover:text-white'
                }`}
              >
                {m.rotulo}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
