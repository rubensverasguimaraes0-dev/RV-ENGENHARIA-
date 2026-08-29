import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra, carregarPainelObra } from '@/lib/dados/obra'
import { carregarDetalheDaObra } from '@/lib/dados/painel-detalhe'
import { carregarParametros, dadosEmpresa } from '@/lib/parametros'
import { statusDaParcela, valorEfetivo } from '@/lib/domain/pagamentos'
import { Documento, BlocoDados, BarraImpressao } from '@/components/documento'
import { BotaoImprimir } from '@/components/botao-imprimir'
import { formatarData, formatarMoeda, formatarPercentual, hojeISO } from '@/lib/format'

export const metadata = { title: 'Relatório final da obra' }

/**
 * O fechamento de tudo, para o engenheiro: quanto entrou, quanto saiu, para
 * onde foi, e o que sobrou.
 *
 * DOCUMENTO INTERNO. Traz custo, margem e o valor pago a cada funcionario —
 * numeros que a especificacao proibe em documento de cliente (item 11.1). O
 * aviso vai impresso no topo e no rodape de proposito: um papel destes esquecido
 * em cima da mesa da obra entrega a folha de pagamento inteira.
 *
 * Para o cliente existem outros dois: o relatorio de servicos prestados e o
 * cronograma de pagamentos.
 */
export default async function RelatorioFinal({
  params,
}: {
  params: Promise<{ obraId: string }>
}) {
  const { obraId } = await params
  await exigirAdmin()

  const obra = await carregarObra(obraId)
  if (!obra) notFound()

  const [painel, detalhe, parametros] = await Promise.all([
    carregarPainelObra(obra),
    carregarDetalheDaObra(obraId),
    carregarParametros(),
  ])

  const empresa = dadosEmpresa(parametros)
  const hoje = hojeISO()
  const cliente = obra.cliente
  const pagador = obra.pagador ?? obra.cliente

  const recebidas = detalhe.parcelas
    .filter((p) => p.valor_recebido !== null && p.valor_recebido > 0)
    .sort((a, b) => (a.numero_parcela ?? 0) - (b.numero_parcela ?? 0))

  const pagoAEquipe = detalhe.pagamentosEquipe.reduce((s, p) => s + p.valor, 0)
  const semComprovante = detalhe.pagamentosEquipe.filter((p) => !p.tem_comprovante).length

  // Quanto cada um recebeu de fato, para comparar com o que a obra apurou.
  const pagoPorFuncionario = new Map<string, number>()
  for (const p of detalhe.pagamentosEquipe) {
    pagoPorFuncionario.set(p.funcionario_id, (pagoPorFuncionario.get(p.funcionario_id) ?? 0) + p.valor)
  }

  // A secao 5 so existe quando ha pagamento registrado. Com o numero fixo no
  // texto, o relatorio ia de "4" para "6" e parecia faltar pagina.
  const temPagamentos = detalhe.pagamentosEquipe.length > 0
  const nMes = temPagamentos ? 6 : 5

  const categorias = [
    { nome: 'Diárias da equipe', valor: painel.custo_mao_obra },
    { nome: 'Alimentação (quentinhas)', valor: painel.custo_quentinhas },
    { nome: 'Materiais com nota', valor: painel.custo_materiais },
    { nome: 'Despesas sem nota', valor: painel.custo_despesas_sem_nota },
    { nome: 'Locações', valor: painel.custo_locacoes },
    { nome: 'Caçamba e entulho', valor: painel.custo_entulho },
    { nome: 'Serviços de terceiros', valor: painel.custo_terceiros },
  ]

  return (
    <>
      <BarraImpressao>
        <Link href={`/obras/${obraId}`} className="botao botao-neutro">
          Voltar à obra
        </Link>
        <BotaoImprimir />
      </BarraImpressao>

      <Documento
        empresa={empresa}
        titulo="Relatório final da obra"
        subtitulo="Documento interno"
        geradoEm={new Date()}
        cabecalho={
          <>
            <div className="mb-2 border-2 border-erro-700 bg-erro-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-erro-700">
              Documento interno — contém custo, margem e o valor pago a cada funcionário.
              Não entregar ao cliente.
            </div>
            <BlocoDados
              itens={[
                { rotulo: 'Obra', valor: obra.nome },
                { rotulo: 'Cliente', valor: cliente?.nome ?? '—' },
                { rotulo: 'Local', valor: obra.endereco ?? '—' },
                { rotulo: 'Quem paga', valor: pagador?.nome ?? '—' },
                { rotulo: 'Início', valor: obra.data_inicio ? formatarData(obra.data_inicio) : '—' },
                { rotulo: 'Situação', valor: obra.status.replace('_', ' ') },
              ]}
            />
          </>
        }
      >
        <h2 className="text-[12px] font-bold uppercase text-rv-900 mt-1 mb-1">
          1. O resultado da obra
        </h2>
        <table className="tabela">
          <tbody>
            <tr>
              <td>Valor do contrato</td>
              <td className="num">{formatarMoeda(obra.valor_contrato)}</td>
            </tr>
            <tr>
              <td>Recebido do cliente</td>
              <td className="num">{formatarMoeda(painel.total_recebido)}</td>
            </tr>
            <tr>
              <td>Saldo do contrato a receber</td>
              <td className="num">{formatarMoeda(painel.saldo_contrato)}</td>
            </tr>
            <tr className="subtotal">
              <td>Custo realizado</td>
              <td className="num">{formatarMoeda(painel.apuracao.custo_total)}</td>
            </tr>
            <tr className="total">
              <td>
                Resultado{obra.status !== 'concluida' && ' parcial'} — margem{' '}
                {formatarPercentual(painel.apuracao.margem, 1)}
              </td>
              <td className="num">{formatarMoeda(painel.apuracao.resultado)}</td>
            </tr>
          </tbody>
        </table>
        {obra.status !== 'concluida' && (
          <p className="mt-1 text-[10px] text-slate-600">
            A obra ainda não está concluída: o resultado acima é parcial e cai a cada semana nova
            lançada.
          </p>
        )}

        <h2 className="text-[12px] font-bold uppercase text-rv-900 mt-4 mb-1">
          2. O que entrou — recebimentos do cliente
        </h2>
        <table className="tabela">
          <thead>
            <tr>
              <th>Parcela</th>
              <th>Vencimento</th>
              <th>Recebido em</th>
              <th>Forma</th>
              <th className="num">Valor</th>
              <th className="num">Nesta obra</th>
            </tr>
          </thead>
          <tbody>
            {recebidas.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.numero_parcela}
                  {p.balao ? ' (saldo)' : ''}
                </td>
                <td>{p.data_prevista ? formatarData(p.data_prevista) : '—'}</td>
                <td>{p.data_recebimento ? formatarData(p.data_recebimento) : '—'}</td>
                <td>{p.forma_pagamento ?? '—'}</td>
                <td className="num">{formatarMoeda(p.valor_recebido ?? 0)}</td>
                <td className="num">{formatarMoeda(valorEfetivo(p))}</td>
              </tr>
            ))}
            <tr className="total">
              <td colSpan={5}>Total recebido nesta obra</td>
              <td className="num">{formatarMoeda(painel.total_recebido)}</td>
            </tr>
          </tbody>
        </table>
        {detalhe.parcelas.some((p) => statusDaParcela(p, hoje) === 'atrasada') && (
          <p className="mt-1 text-[10px] text-erro-700 font-semibold">
            Há parcela vencida sem recebimento — ver o cronograma de pagamentos.
          </p>
        )}

        <h2 className="text-[12px] font-bold uppercase text-rv-900 mt-4 mb-1">
          3. O que saiu — custo por categoria
        </h2>
        <table className="tabela">
          <tbody>
            {categorias.map((c) => (
              <tr key={c.nome}>
                <td>{c.nome}</td>
                <td className="num">{formatarMoeda(c.valor)}</td>
                <td className="num w-20">
                  {painel.apuracao.custo_total > 0
                    ? formatarPercentual(c.valor / painel.apuracao.custo_total, 1)
                    : '—'}
                </td>
              </tr>
            ))}
            <tr className="total">
              <td>Custo total da obra</td>
              <td className="num">{formatarMoeda(painel.apuracao.custo_total)}</td>
              <td className="num">100,0%</td>
            </tr>
          </tbody>
        </table>

        <h2 className="text-[12px] font-bold uppercase text-rv-900 mt-4 mb-1">
          4. Quanto foi para cada funcionário
        </h2>
        <table className="tabela">
          <thead>
            <tr>
              <th>Funcionário</th>
              <th>Função</th>
              <th className="num">Diárias</th>
              <th>Período na obra</th>
              <th className="num">Apurado</th>
              <th className="num">Pago com registro</th>
            </tr>
          </thead>
          <tbody>
            {detalhe.equipe.map((l) => {
              const pagoAEle = pagoPorFuncionario.get(l.funcionario_id) ?? 0
              return (
                <tr key={l.funcionario_id}>
                  <td>{l.nome}</td>
                  <td>{l.funcao || '—'}</td>
                  <td className="num">{l.diarias.toLocaleString('pt-BR')}</td>
                  <td className="whitespace-nowrap">
                    {formatarData(l.primeira)} a {formatarData(l.ultima)}
                  </td>
                  <td className="num">{formatarMoeda(l.total)}</td>
                  <td className="num">{pagoAEle > 0 ? formatarMoeda(pagoAEle) : '—'}</td>
                </tr>
              )
            })}
            <tr className="total">
              <td colSpan={4}>Total de diárias</td>
              <td className="num">{formatarMoeda(painel.custo_mao_obra)}</td>
              <td className="num">{formatarMoeda(pagoAEquipe)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-1 text-[10px] text-slate-600">
          &ldquo;Apurado&rdquo; é o que as presenças lançadas somam. &ldquo;Pago com registro&rdquo;
          é o que foi lançado na tela de pagamento da semana. A diferença entre as duas colunas não
          é erro de conta: é pagamento feito e ainda não registrado no aplicativo.
        </p>

        {temPagamentos && (
          <>
            <h2 className="text-[12px] font-bold uppercase text-rv-900 mt-4 mb-1">
              5. Pagamentos feitos à equipe
            </h2>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Semana</th>
                  <th>Funcionário</th>
                  <th>Forma</th>
                  <th>Comprovante</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {detalhe.pagamentosEquipe.map((p) => (
                  <tr key={p.id}>
                    <td>{formatarData(p.data_pagamento)}</td>
                    <td>{p.semana ?? '—'}</td>
                    <td>{p.nome}</td>
                    <td>{p.forma_pagamento ?? '—'}</td>
                    <td>{p.tem_comprovante ? 'anexado' : '—'}</td>
                    <td className="num">{formatarMoeda(p.valor)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td colSpan={5}>Total pago à equipe, com registro</td>
                  <td className="num">{formatarMoeda(pagoAEquipe)}</td>
                </tr>
              </tbody>
            </table>
            {semComprovante > 0 && (
              <p className="mt-1 text-[10px] text-alerta-700">
                {semComprovante} pagamento(s) sem comprovante anexado.
              </p>
            )}
          </>
        )}

        <h2 className="text-[12px] font-bold uppercase text-rv-900 mt-4 mb-1">
          {nMes}. Mês a mês — o caixa da obra
        </h2>
        <table className="tabela">
          <thead>
            <tr>
              <th>Mês</th>
              <th className="num">Recebido</th>
              <th className="num">Mão de obra</th>
              <th className="num">Alimentação</th>
              <th className="num">Materiais</th>
              <th className="num">Saiu</th>
              <th className="num">Sobrou</th>
            </tr>
          </thead>
          <tbody>
            {detalhe.meses
              .filter((m) => !m.futuro)
              .map((m) => (
                <tr key={m.chave}>
                  <td className="whitespace-nowrap">{m.rotulo}</td>
                  <td className="num">{formatarMoeda(m.recebido)}</td>
                  <td className="num">{formatarMoeda(m.custo_mao_obra)}</td>
                  <td className="num">{formatarMoeda(m.custo_alimentacao)}</td>
                  <td className="num">{formatarMoeda(m.custo_materiais)}</td>
                  <td className="num">{formatarMoeda(m.custo)}</td>
                  <td className="num">{formatarMoeda(m.sobrou)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <p className="mt-1 text-[10px] text-slate-600">
          &ldquo;Sobrou&rdquo; é caixa do mês, não lucro: numa empreitada as parcelas não
          acompanham o ritmo do trabalho. Meses ainda a vencer ficam fora deste quadro.
        </p>

        <p className="mt-4 border-t border-slate-300 pt-1 text-[10px] font-semibold text-erro-700">
          Documento interno da RV Engenharia. Não entregar ao cliente.
        </p>
      </Documento>
    </>
  )
}
