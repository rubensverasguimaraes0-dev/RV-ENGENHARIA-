import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirUsuario } from '@/lib/supabase/sessao'
import { criarClienteServidor } from '@/lib/supabase/server'
import { listarObrasVisiveis } from '@/lib/dados/obra'
import { carregarParametros, centavos, lista } from '@/lib/parametros'
import { TituloPagina, Cartao, Etiqueta } from '@/components/ui'
import { formatarData, hojeISO, nomeDoDia, somarDias, ehSabado } from '@/lib/format'
import { sugestaoParaData } from '@/lib/domain/lancamento'
import { ListaPresenca, BlocoQuentinhas, type PessoaDoDia } from './lista-presenca'
import type { TipoDiaria } from '@/lib/domain/tipos'

export default async function PaginaLancamentoDiario({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>
  searchParams: Promise<{ data?: string }>
}) {
  const { obraId } = await params
  const { data: dataParam } = await searchParams
  const usuario = await exigirUsuario()
  const ehAdmin = usuario.perfil === 'admin'

  const obras = await listarObrasVisiveis()
  const obra = obras.find((o) => o.id === obraId)
  if (!obra) notFound()

  const data = dataParam && /^\d{4}-\d{2}-\d{2}$/.test(dataParam) ? dataParam : hojeISO()
  const supabase = await criarClienteServidor()
  const parametros = await carregarParametros()

  // O admin ve a diaria de cada um; o lancador le a view sem valor nem PIX.
  const { data: equipeData } = ehAdmin
    ? await supabase
        .from('funcionarios')
        .select('id, nome, funcao, tipo, valor_diaria, status')
        .is('excluido_em', null)
        .neq('status', 'desligado')
        .order('nome')
    : await supabase
        .from('funcionarios_visiveis')
        .select('id, nome, funcao, tipo, status')
        .neq('status', 'desligado')
        .order('nome')

  const [{ data: lancamentosData }, { data: quentinhasData }, { data: semanaData }] =
    await Promise.all([
      supabase
        .from('lancamentos_diarios')
        .select('funcionario_id, tipo_diaria, valor_diaria, valor_vale')
        .eq('obra_id', obraId)
        .eq('data', data)
        .is('excluido_em', null),
      supabase
        .from('quentinhas')
        .select('quantidade, valor_unitario')
        .eq('obra_id', obraId)
        .eq('data', data)
        .is('excluido_em', null),
      supabase
        .from('semanas')
        .select('id, numero, status')
        .eq('obra_id', obraId)
        .lte('data_inicio', data)
        .gte('data_fim', data)
        .is('excluido_em', null)
        .maybeSingle(),
    ])

  const lancamentos = (lancamentosData ?? []) as {
    funcionario_id: string
    tipo_diaria: TipoDiaria
    valor_diaria: number
    valor_vale: number
  }[]
  const porFuncionario = new Map(lancamentos.map((l) => [l.funcionario_id, l]))

  const pessoas: PessoaDoDia[] = (equipeData ?? []).map((f) => {
    const l = porFuncionario.get(f.id as string)
    return {
      id: f.id as string,
      nome: f.nome as string,
      funcao: (f.funcao as string) ?? null,
      tipo: (f.tipo as 'funcionario' | 'parceiro') ?? 'funcionario',
      valor_diaria: ehAdmin ? Number((f as { valor_diaria?: number }).valor_diaria ?? 0) : null,
      presente: Boolean(l),
      tipo_diaria: l?.tipo_diaria ?? 'cheia',
      valor_lancado: l ? Number(l.valor_diaria) : null,
      valor_vale: l ? Number(l.valor_vale) : 0,
    }
  })

  const quentinhas = (quentinhasData ?? []).map((q) => ({
    quantidade: Number(q.quantidade ?? 0),
    valor_unitario: Number(q.valor_unitario ?? 0),
  }))

  const semana = semanaData as { id: string; numero: number; status: string } | null
  const semanaFechada = semana?.status === 'fechada'
  const sugestao = sugestaoParaData(data)

  return (
    <>
      <TituloPagina
        titulo="Lançar o dia"
        subtitulo={
          <>
            {obra.nome} · {obra.cliente_nome}
            {semana && (
              <>
                {' · '}Semana {semana.numero}{' '}
                {semanaFechada ? (
                  <Etiqueta tom="erro">fechada</Etiqueta>
                ) : (
                  <Etiqueta tom="ok">aberta</Etiqueta>
                )}
              </>
            )}
          </>
        }
        acoes={
          <Link href={`/obras/${obraId}`} className="botao botao-neutro">
            Voltar à obra
          </Link>
        }
      />

      <div className="cartao p-2 mb-3 flex items-center justify-between gap-2">
        <Link
          href={`/obras/${obraId}/dia?data=${somarDias(data, -1)}`}
          className="botao botao-neutro"
          aria-label="Dia anterior"
        >
          ◀
        </Link>
        <div className="text-center">
          <div className="font-bold text-rv-900">
            {nomeDoDia(data)}, {formatarData(data)}
          </div>
          {data !== hojeISO() && (
            <Link href={`/obras/${obraId}/dia`} className="text-xs text-rv-700 underline">
              voltar para hoje
            </Link>
          )}
        </div>
        <Link
          href={`/obras/${obraId}/dia?data=${somarDias(data, 1)}`}
          className="botao botao-neutro"
          aria-label="Próximo dia"
        >
          ▶
        </Link>
      </div>

      {semanaFechada && (
        <p className="mb-3 text-sm rounded border border-erro-700/30 bg-erro-100 text-erro-700 px-3 py-2">
          A semana {semana?.numero} já foi fechada. Reabra a semana para alterar os lançamentos
          deste dia.
        </p>
      )}

      {ehSabado(data) && (
        <p className="mb-3 text-sm rounded border border-alerta-700/30 bg-alerta-100 text-alerta-700 px-3 py-2">
          {sugestao.motivo}
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <Cartao titulo={`Presença — um toque marca (${pessoas.filter((p) => p.presente).length} de ${pessoas.length})`}>
          <ListaPresenca
            obraId={obraId}
            data={data}
            pessoas={pessoas}
            mostrarValores={ehAdmin}
            semanaFechada={semanaFechada}
          />
        </Cartao>

        <Cartao titulo="Quentinhas do dia">
          <BlocoQuentinhas
            obraId={obraId}
            data={data}
            faixas={lista(parametros, 'faixas_quentinha', [1500, 1800, 2200])}
            valorPadrao={centavos(parametros, 'valor_quentinha_padrao', 1800)}
            sugerirQuentinha={sugestao.sugerir_quentinha}
            registros={quentinhas}
            semanaFechada={semanaFechada}
          />
        </Cartao>
      </div>
    </>
  )
}
