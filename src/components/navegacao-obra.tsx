'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Navegacao interna da obra. O lancador so ve o que pode usar: lancar o dia e
 * fotografar nota. O resto e do administrador.
 */
const ABAS = [
  { sufixo: '', rotulo: 'Painel', soAdmin: true },
  { sufixo: '/dia', rotulo: 'Lançar o dia', soAdmin: false },
  { sufixo: '/semanas', rotulo: 'Semanas', soAdmin: true },
  { sufixo: '/notas', rotulo: 'Notas', soAdmin: false },
  { sufixo: '/pagamentos', rotulo: 'Pagamentos', soAdmin: true },
  { sufixo: '/almoxarifado', rotulo: 'Almoxarifado', soAdmin: true },
  { sufixo: '/medicoes', rotulo: 'Medições', soAdmin: true },
  { sufixo: '/fechamento', rotulo: 'Fechamento', soAdmin: true },
  { sufixo: '/orcamentos', rotulo: 'Orçamentos', soAdmin: true },
  { sufixo: '/arquivos', rotulo: 'Arquivos', soAdmin: true },
  { sufixo: '/resultado', rotulo: 'Resultado', soAdmin: true },
]

export function NavegacaoObra({
  obraId,
  perfil,
}: {
  obraId: string
  perfil: 'admin' | 'lancador'
}) {
  const caminho = usePathname()
  const base = `/obras/${obraId}`
  const abas = ABAS.filter((a) => !a.soAdmin || perfil === 'admin')

  return (
    <nav className="nao-imprimir mb-3 -mx-1 overflow-x-auto">
      <ul className="flex gap-1 px-1 min-w-max">
        {abas.map((a) => {
          const href = `${base}${a.sufixo}`
          const ativo = a.sufixo === '' ? caminho === base : caminho.startsWith(href)
          return (
            <li key={a.rotulo}>
              <Link
                href={href}
                className={`block px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap border ${
                  ativo
                    ? 'bg-rv-800 text-white border-rv-800'
                    : 'bg-white text-rv-800 border-slate-300 hover:bg-rv-50'
                }`}
              >
                {a.rotulo}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
