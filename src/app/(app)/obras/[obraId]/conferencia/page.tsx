import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra, carregarPainelObra } from '@/lib/dados/obra'
import { carregarConferencia } from '@/lib/dados/conferencia'
import type { Achado, Area, Situacao } from '@/lib/domain/conferencia'

/**
 * Conferencia da obra: o checklist que o proprio aplicativo levanta do banco.
 *
 * A tela existe por um motivo pratico — checklist feito de fora, olhando
 * arquivo de carga ou lembranca, erra. Aqui o que aparece e o que esta lancado.
 *
 * Tela interna: fala de atraso, custo e lucro (spec 11.1).
 */
export default async function Conferencia({
  params,
}: {
  params: Promise<{ obraId: string }>
}) {
  const { obraId } = await params
  await exigirAdmin()

  const obra = await carregarObra(obraId)
  if (!obra) notFound()

  const painel = await carregarPainelObra(obra)
  const achados = await carregarConferencia(obra, painel)

  const contagem = {
    pendente: achados.filter((a) => a.situacao === 'pendente').length,
    atencao: achados.filter((a) => a.situacao === 'atencao').length,
    ok: achados.filter((a) => a.situacao === 'ok').length,
  }
  const tudoEmDia = contagem.pendente === 0 && contagem.atencao === 0

  return (
    <div className="p-3 space-y-4">
      <header>
        <h1 className="text-lg font-bold text-rv-900">Conferência da obra</h1>
        <p className="text-sm text-slate-600">
          {tudoEmDia
            ? 'Nada pendente. Tudo que a obra precisa está lançado.'
            : 'O que está lançado, o que falta e o que merece atenção — lido do banco agora.'}
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Contador rotulo="Pendente" valor={contagem.pendente} situacao="pendente" />
        <Contador rotulo="Atenção" valor={contagem.atencao} situacao="atencao" />
        <Contador rotulo="Em dia" valor={contagem.ok} situacao="ok" />
      </div>

      {AREAS.map(({ chave, rotulo, descricao, atalho }) => {
        const daArea = achados.filter((a) => a.area === chave)
        if (daArea.length === 0) return null
        return (
          <section key={chave} className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-rv-900">{rotulo}</h2>
              <Link
                href={`/obras/${obraId}${atalho}`}
                className="text-xs font-semibold text-rv-700 underline"
              >
                abrir
              </Link>
            </div>
            <p className="text-xs text-slate-500 -mt-1">{descricao}</p>
            <ul className="space-y-2">
              {daArea.map((a) => (
                <LinhaAchado key={`${a.area}-${a.titulo}`} achado={a} />
              ))}
            </ul>
          </section>
        )
      })}

      <p className="text-xs text-slate-500 border-t border-slate-200 pt-3">
        Esta página lê o banco toda vez que é aberta. Se alguma coisa aqui não bater com a
        realidade da obra, é porque o lançamento ainda não foi feito — não porque a conferência
        está desatualizada.
      </p>
    </div>
  )
}

// -----------------------------------------------------------------------------

const AREAS: { chave: Area; rotulo: string; descricao: string; atalho: string }[] = [
  {
    chave: 'recebimentos',
    rotulo: 'O que o cliente paga',
    descricao: 'Parcelas vencidas, a próxima a vencer e comprovantes faltando.',
    atalho: '/pagamentos',
  },
  {
    chave: 'presenca',
    rotulo: 'A presença da equipe',
    descricao: 'Semanas por fechar e atraso no lançamento do dia.',
    atalho: '/semanas',
  },
  {
    chave: 'equipe',
    rotulo: 'O que o senhor paga à equipe',
    descricao: 'Semanas fechadas cujo pagamento ainda não foi registrado.',
    atalho: '/semanas',
  },
  {
    chave: 'custos',
    rotulo: 'O lucro da obra',
    descricao: 'Custo que falta lançar faz o lucro aparecer maior do que é.',
    atalho: '/resultado',
  },
]

const CORES: Record<Situacao, { caixa: string; etiqueta: string; texto: string }> = {
  pendente: {
    caixa: 'border-red-300 bg-red-50',
    etiqueta: 'bg-red-600 text-white',
    texto: 'Pendente',
  },
  atencao: {
    caixa: 'border-amber-300 bg-amber-50',
    etiqueta: 'bg-amber-500 text-white',
    texto: 'Atenção',
  },
  ok: {
    caixa: 'border-emerald-300 bg-emerald-50',
    etiqueta: 'bg-emerald-600 text-white',
    texto: 'Em dia',
  },
}

function LinhaAchado({ achado }: { achado: Achado }) {
  const cor = CORES[achado.situacao]
  return (
    <li className={`rounded-lg border p-3 ${cor.caixa}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-slate-900">{achado.titulo}</span>
        <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${cor.etiqueta}`}>
          {cor.texto}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-700">{achado.detalhe}</p>
    </li>
  )
}

function Contador({
  rotulo,
  valor,
  situacao,
}: {
  rotulo: string
  valor: number
  situacao: Situacao
}) {
  const cor = CORES[situacao]
  return (
    <div className={`rounded-lg border p-3 text-center ${cor.caixa}`}>
      <div className="text-2xl font-bold tabular-nums text-slate-900">{valor}</div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-600">{rotulo}</div>
    </div>
  )
}
