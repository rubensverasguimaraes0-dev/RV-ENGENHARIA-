import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirUsuario } from '@/lib/supabase/sessao'
import { carregarObra, carregarPainelObra, listarObrasVisiveis } from '@/lib/dados/obra'
import { carregarDetalheDaObra } from '@/lib/dados/painel-detalhe'
import { criarClienteServidor } from '@/lib/supabase/server'
import { TituloPagina, Cartao, Indicador, Moeda, Etiqueta } from '@/components/ui'
import { formatarData, formatarMoeda, formatarPercentual, hojeISO } from '@/lib/format'
import { CORES, GraficoAcumulado, GraficoSemanas, Legenda } from '@/components/graficos'
import { TabelaFicha } from '@/components/tabela-ficha'

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

  const [painel, detalhe] = await Promise.all([
    carregarPainelObra(obra),
    carregarDetalheDaObra(obraId),
  ])
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

          <Cartao titulo="Documentos da obra">
            <div className="grid grid-cols-1 gap-2">
              <Link href={`/obras/${obraId}/fechamento`} className="botao botao-neutro">
                Relatório de serviços prestados
              </Link>
              <Link href={`/obras/${obraId}/relatorio-despesas`} className="botao botao-neutro">
                Relatório de despesas
              </Link>
              <Link href={`/obras/${obraId}/pagamentos/relatorio`} className="botao botao-neutro">
                Cronograma de pagamentos
              </Link>
              <Link
                href={`/obras/${obraId}/relatorio-final`}
                className="botao botao-primario"
              >
                Relatório final (interno)
              </Link>
            </div>
          </Cartao>
        </div>
      </div>

      {detalhe.evolucao.length > 0 && (
        <Cartao titulo="Como a obra andou, semana a semana" className="mt-3">
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="min-w-0">
              <h3 className="text-[13px] font-semibold text-rv-900 mb-1">Custo de cada semana</h3>
              <Legenda
                itens={[
                  { nome: 'Mão de obra', cor: CORES.vermelho },
                  { nome: 'Alimentação', cor: CORES.ambar },
                ]}
              />
              <GraficoSemanas
                pontos={detalhe.evolucao.map((e) => ({
                  rotulo: `S${e.semana}`,
                  detalhe: `Semana ${e.semana}, de ${formatarData(e.data_inicio)} a ${formatarData(e.data_fim)}`,
                  partes: [
                    { nome: 'Mão de obra', valor: e.mao_obra, cor: CORES.vermelho },
                    { nome: 'Alimentação', valor: e.alimentacao, cor: CORES.ambar },
                  ],
                }))}
              />
            </div>

            <div className="min-w-0">
              <h3 className="text-[13px] font-semibold text-rv-900 mb-1">
                Acumulado: o que entrou e o que saiu
              </h3>
              <Legenda
                itens={[
                  { nome: 'Custo acumulado', cor: CORES.vermelho },
                  { nome: 'Recebido acumulado', cor: CORES.azul },
                ]}
              />
              <GraficoAcumulado
                series={[
                  { nome: 'Custo', cor: CORES.vermelho },
                  { nome: 'Recebido', cor: CORES.azul },
                ]}
                pontos={detalhe.evolucao.map((e) => ({
                  rotulo: `S${e.semana}`,
                  detalhe: `Até ${formatarData(e.data_fim)}`,
                  valores: [e.custo_acumulado, e.recebido_acumulado],
                }))}
              />
            </div>
          </div>

          <div className="mt-3">
            <TabelaFicha
              itens={detalhe.evolucao}
              chave={(e) => String(e.semana)}
              colunas={[
                {
                  rotulo: 'Semana',
                  celular: 'titulo',
                  valor: (e) => (
                    <>
                      Semana {e.semana}
                      <span className="block text-[12px] font-normal text-slate-500 lg:inline lg:ml-1">
                        {formatarData(e.data_inicio)} a {formatarData(e.data_fim)}
                      </span>
                    </>
                  ),
                },
                {
                  rotulo: 'Custo da semana',
                  celular: 'destaque',
                  num: true,
                  valor: (e) => formatarMoeda(e.custo),
                },
                { rotulo: 'Mão de obra', num: true, valor: (e) => formatarMoeda(e.mao_obra) },
                { rotulo: 'Alimentação', num: true, valor: (e) => formatarMoeda(e.alimentacao) },
                {
                  rotulo: 'Custo acumulado',
                  num: true,
                  valor: (e) => formatarMoeda(e.custo_acumulado),
                },
                {
                  rotulo: 'Recebido acumulado',
                  num: true,
                  valor: (e) => formatarMoeda(e.recebido_acumulado),
                },
              ]}
            />
          </div>
        </Cartao>
      )}

      {detalhe.meses.length > 0 && (
        <Cartao titulo="Mês a mês: quanto entrou, quanto saiu, quanto sobrou" className="mt-3">
          <TabelaFicha
            itens={detalhe.meses}
            chave={(m) => m.chave}
            classeDaLinha={(m) => (m.futuro ? 'text-slate-500 italic' : '')}
            colunas={[
              {
                rotulo: 'Mês',
                celular: 'titulo',
                valor: (m) => (
                  <>
                    {m.rotulo}
                    {m.futuro && (
                      <span className="ml-1 not-italic etiqueta etiqueta-neutra">a vencer</span>
                    )}
                  </>
                ),
              },
              {
                rotulo: 'Sobrou',
                celular: 'destaque',
                num: true,
                tom: (m) => (m.futuro ? 'neutro' : m.sobrou >= 0 ? 'ok' : 'erro'),
                valor: (m) => (m.futuro ? '—' : formatarMoeda(m.sobrou)),
              },
              { rotulo: 'Previsto', num: true, valor: (m) => formatarMoeda(m.previsto) },
              { rotulo: 'Recebido', num: true, valor: (m) => formatarMoeda(m.recebido) },
              { rotulo: 'Saiu no mês', num: true, valor: (m) => formatarMoeda(m.custo) },
              {
                rotulo: 'Sobra acumulada',
                num: true,
                valor: (m) => (m.futuro ? '—' : formatarMoeda(m.sobrou_acumulado)),
              },
              {
                rotulo: 'Mão de obra',
                num: true,
                celular: 'escondido',
                valor: (m) => formatarMoeda(m.custo_mao_obra),
              },
              {
                rotulo: 'Alimentação',
                num: true,
                celular: 'escondido',
                valor: (m) => formatarMoeda(m.custo_alimentacao),
              },
              {
                rotulo: 'Materiais',
                num: true,
                celular: 'escondido',
                valor: (m) => formatarMoeda(m.custo_materiais),
              },
            ]}
          />
          <p className="mt-2 text-[11px] text-slate-500">
            &ldquo;Sobrou&rdquo; é caixa do mês — o que entrou menos o que saiu — e não lucro da
            obra. Numa empreitada as parcelas não acompanham o ritmo do trabalho: um mês pode
            sobrar muito e o seguinte faltar, sem que nada tenha mudado no negócio. O lucro só
            fecha no Resultado, com a obra encerrada. Mês marcado como{' '}
            <em>a vencer</em> é estimativa: mostra a parcela combinada, ainda não recebida.
            Materiais contam apenas o que a RV pagou; nota paga pelo cliente não sai do seu caixa.
          </p>
        </Cartao>
      )}

      {detalhe.equipe.length > 0 && (
        <Cartao titulo={`Quem trabalhou nesta obra (${detalhe.equipe.length})`} className="mt-3">
          <TabelaFicha
            itens={detalhe.equipe}
            chave={(l) => l.funcionario_id}
            rodape={
              <tr className="total">
                <td colSpan={5}>Total de mão de obra</td>
                <td className="num">
                  {formatarMoeda(detalhe.equipe.reduce((s, l) => s + l.total, 0))}
                </td>
                <td></td>
              </tr>
            }
            colunas={[
              {
                rotulo: 'Funcionário',
                celular: 'titulo',
                valor: (l) => (
                  <>
                    <span className="font-medium">{l.nome}</span>
                    <span className="block text-[12px] font-normal text-slate-500 lg:hidden">
                      {l.funcao || '—'}
                    </span>
                  </>
                ),
              },
              {
                rotulo: 'Total pago',
                celular: 'destaque',
                num: true,
                valor: (l) => formatarMoeda(l.total),
              },
              { rotulo: 'Função', celular: 'escondido', valor: (l) => l.funcao || '—' },
              { rotulo: 'Diárias', num: true, valor: (l) => l.diarias.toLocaleString('pt-BR') },
              {
                rotulo: 'Peso no custo',
                num: true,
                valor: (l) => formatarPercentual(l.fracao, 1),
              },
              {
                rotulo: 'Dias',
                valor: (l) => (
                  <span className="whitespace-nowrap text-[12px] text-slate-600">
                    {l.dias_cheios} cheio(s)
                    {l.dias_meios > 0 && ` · ${l.dias_meios} meio(s)`}
                    {l.dias_sem_diaria > 0 && ` · ${l.dias_sem_diaria} sem diária`}
                  </span>
                ),
              },
              {
                rotulo: 'Período na obra',
                valor: (l) => (
                  <span className="whitespace-nowrap text-[12px] text-slate-600">
                    {formatarData(l.primeira)} a {formatarData(l.ultima)}
                  </span>
                ),
              },
            ]}
          />
        </Cartao>
      )}

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
