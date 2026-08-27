import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirUsuario } from '@/lib/supabase/sessao'
import { carregarObra, carregarPainelObra, listarObrasVisiveis } from '@/lib/dados/obra'
import { criarClienteServidor } from '@/lib/supabase/server'
import { TituloPagina, Cartao, Indicador, Moeda, Etiqueta } from '@/components/ui'
import { formatarData, formatarMoeda, formatarPercentual, hojeISO } from '@/lib/format'

export default async function PainelDaObra({ params }: { params: Promise<{ obraId: string }> }) {
  const { obraId } = await params
  const usuario = await exigirUsuario()

  // O lancador nao le a tabela obras: para ele o painel vem da view segura.
  if (usuario.perfil !== 'admin') {
    const minhas = await listarObrasVisiveis()
    const obra = minhas.find((o) => o.id === obraId)
    if (!obra) notFound()
    return <PainelDoLancador obraId={obraId} nome={obra.nome} cliente={obra.cliente_nome} />
  }

  const obra = await carregarObra(obraId)
  if (!obra) notFound()

  const painel = await carregarPainelObra(obra)
  const supabase = await criarClienteServidor()
  const { count: notasSemFoto } = await supabase
    .from('notas_fiscais')
    .select('id', { count: 'exact', head: true })
    .eq('obra_id', obraId)
    .is('excluido_em', null)
    .is('repassada_em', null)

  const pagador = obra.pagador ?? obra.cliente

  return (
    <>
      <TituloPagina
        titulo={obra.nome}
        subtitulo={
          <>
            {obra.cliente?.nome}
            {obra.pagador && obra.pagador.id !== obra.cliente?.id && (
              <> · paga: <strong>{obra.pagador.nome}</strong></>
            )}
            {obra.endereco ? ` · ${obra.endereco}` : ''}
          </>
        }
        acoes={
          <>
            <Link href={`/obras/${obraId}/dia`} className="botao botao-primario">
              Lançar o dia
            </Link>
            <Link href={`/obras/${obraId}/notas/nova`} className="botao botao-neutro">
              Fotografar nota
            </Link>
            <Link href={`/cadastros/obras?editar=${obraId}`} className="botao botao-neutro">
              Editar obra
            </Link>
          </>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-3">
        <Indicador rotulo="Valor do contrato" valor={formatarMoeda(obra.valor_contrato)} />
        <Indicador
          rotulo="Já recebido"
          valor={formatarMoeda(painel.total_recebido)}
          tom="ok"
          detalhe="líquido do que é de outro contrato"
        />
        <Indicador
          rotulo="Saldo do contrato"
          valor={formatarMoeda(painel.saldo_contrato)}
          tom={painel.saldo_contrato > 0 ? 'alerta' : 'ok'}
        />
        <Indicador
          rotulo="Resultado parcial"
          valor={formatarMoeda(painel.apuracao.resultado)}
          tom={painel.apuracao.resultado >= 0 ? 'ok' : 'erro'}
          detalhe={`margem ${formatarPercentual(painel.apuracao.margem)}`}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Cartao titulo="Custo acumulado">
          <table className="tabela">
            <tbody>
              <tr className="secao">
                <td colSpan={2}>Mão de obra</td>
              </tr>
              <Linha rotulo="Diárias" valor={painel.custo_mao_obra} />
              <Linha rotulo="Quentinhas" valor={painel.custo_quentinhas} />
              <tr className="secao">
                <td colSpan={2}>Materiais e serviços</td>
              </tr>
              <Linha rotulo="Materiais com nota" valor={painel.custo_materiais} />
              <Linha rotulo="Despesas sem nota" valor={painel.custo_despesas_sem_nota} />
              <Linha rotulo="Locações" valor={painel.custo_locacoes} />
              <Linha rotulo="Caçamba / entulho" valor={painel.custo_entulho} />
              <Linha rotulo="Terceiros" valor={painel.custo_terceiros} />
              <tr className="total">
                <td>Custo realizado</td>
                <td className="num">{formatarMoeda(painel.apuracao.custo_total)}</td>
              </tr>
            </tbody>
          </table>
        </Cartao>

        <div className="space-y-3">
          <Cartao
            titulo="Semana atual"
            acoes={
              <Link href={`/obras/${obraId}/semanas`} className="text-white underline text-xs">
                todas as semanas
              </Link>
            }
          >
            {painel.semana_aberta ? (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">
                    Semana {painel.semana_aberta.numero}{' '}
                    <Etiqueta tom="alerta">em aberto</Etiqueta>
                  </div>
                  <div className="text-xs text-slate-600">
                    a partir de {formatarData(painel.semana_aberta.data_inicio)}
                  </div>
                </div>
                <Link
                  href={`/obras/${obraId}/semanas/${painel.semana_aberta.id}`}
                  className="botao botao-primario"
                >
                  Fechar a semana
                </Link>
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                Nenhuma semana em aberto. Ela é criada sozinha no primeiro lançamento do dia.
              </p>
            )}
          </Cartao>

          <Cartao
            titulo="Notas a repassar"
            acoes={
              <Link href={`/obras/${obraId}/notas`} className="text-white underline text-xs">
                checklist
              </Link>
            }
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-lg font-bold tabular-nums text-rv-900">
                  {formatarMoeda(painel.valor_notas_nao_repassadas)}
                </div>
                <div className="text-xs text-slate-600">
                  {painel.notas_nao_repassadas} nota(s) ainda não repassada(s) ao cliente
                  {notasSemFoto ? '' : ''}
                </div>
              </div>
              <Link href={`/obras/${obraId}/notas`} className="botao botao-neutro">
                Ver notas
              </Link>
            </div>
          </Cartao>

          <Cartao titulo="Atalhos">
            <div className="grid grid-cols-2 gap-2">
              <Link href={`/obras/${obraId}/dia`} className="botao botao-neutro">
                Lançar o dia
              </Link>
              <Link href={`/obras/${obraId}/notas/nova`} className="botao botao-neutro">
                Fotografar nota
              </Link>
              <Link href={`/obras/${obraId}/pagamentos`} className="botao botao-neutro">
                Cronograma
              </Link>
              <Link href={`/obras/${obraId}/resultado`} className="botao botao-neutro">
                Resultado
              </Link>
            </div>
          </Cartao>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-slate-500">
        Painel interno em {formatarData(hojeISO())} — os valores desta tela nunca saem em documento
        de cliente. Pagador do relatório: {pagador?.nome ?? '—'}.
      </p>
    </>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <tr>
      <td>{rotulo}</td>
      <td className="num">
        <Moeda valor={valor} />
      </td>
    </tr>
  )
}

function PainelDoLancador({
  obraId,
  nome,
  cliente,
}: {
  obraId: string
  nome: string
  cliente: string
}) {
  return (
    <>
      <TituloPagina titulo={nome} subtitulo={cliente} />
      <Cartao titulo="O que fazer aqui">
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href={`/obras/${obraId}/dia`} className="botao botao-primario">
            Lançar o dia
          </Link>
          <Link href={`/obras/${obraId}/notas/nova`} className="botao botao-neutro">
            Fotografar nota
          </Link>
        </div>
        <p className="mt-3 text-xs text-slate-600">
          Valores de contrato, custo e resultado da obra são visíveis apenas para o engenheiro.
        </p>
      </Cartao>
    </>
  )
}
