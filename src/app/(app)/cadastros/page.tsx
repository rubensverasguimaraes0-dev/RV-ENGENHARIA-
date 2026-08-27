import { exigirAdmin } from '@/lib/supabase/sessao'
import { TituloPagina } from '@/components/ui'
import Link from 'next/link'

const AREAS = [
  { href: '/cadastros/clientes', titulo: 'Clientes', desc: 'Clientes, grupos com várias unidades e quem paga a conta.' },
  { href: '/cadastros/obras', titulo: 'Obras e locais', desc: 'Obras, forma de contratação, contrato e locais vinculados.' },
  { href: '/cadastros/funcionarios', titulo: 'Funcionários e parceiros', desc: 'Equipe, função, diária, PIX e situação.' },
  { href: '/cadastros/fornecedores', titulo: 'Fornecedores', desc: 'Lojas e fornecedores usados no lançamento de notas.' },
  { href: '/cadastros/terceiros', titulo: 'Terceiros', desc: 'Subempreiteiros: gesseiro, marmoraria, serralheria.' },
  { href: '/cadastros/usuarios', titulo: 'Usuários', desc: 'Quem entra no app e a quais obras o lançador tem acesso.' },
  { href: '/cadastros/precos-referencia', titulo: 'Preços referenciais', desc: 'SINAPI, ORSE e SICRO importados por CSV, base do orçamento executivo.' },
  { href: '/cadastros/parametros', titulo: 'Parâmetros', desc: 'Quentinha, meia diária, margem, BDI, HSP e textos padrão.' },
]

export default async function PaginaCadastros() {
  await exigirAdmin()
  return (
    <>
      <TituloPagina titulo="Cadastros" subtitulo="Base de dados compartilhada pelos três módulos" />
      <div className="grid gap-2 sm:grid-cols-2">
        {AREAS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="cartao p-3 hover:border-rv-600 hover:bg-rv-50 block"
          >
            <div className="font-semibold text-rv-900">{a.titulo}</div>
            <div className="text-sm text-slate-600">{a.desc}</div>
          </Link>
        ))}
      </div>
    </>
  )
}
