import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarContrato } from '@/lib/dados/locacao'
import { saldoDoContrato } from '@/lib/domain/locacao'
import { carregarParametros, dadosEmpresa } from '@/lib/parametros'
import { Documento, BlocoDados, BarraImpressao } from '@/components/documento'
import { BotaoImprimir } from '@/components/botao-imprimir'
import { formatarData, formatarMoeda, hojeISO } from '@/lib/format'

/**
 * Contrato de locacao e recibo de devolucao em PDF (spec 7), com a logo e o
 * rodape da RV. Antes da devolucao sai como contrato; depois, como recibo.
 */
export default async function ContratoLocacaoPDF({
  params,
}: {
  params: Promise<{ contratoId: string }>
}) {
  const { contratoId } = await params
  await exigirAdmin()

  const [contrato, parametros] = await Promise.all([
    carregarContrato(contratoId),
    carregarParametros(),
  ])
  if (!contrato) notFound()

  const empresa = dadosEmpresa(parametros)
  const a = contrato.apuracao
  const devolvido = Boolean(contrato.data_devolucao)
  const saldo = saldoDoContrato(a.valor_total, contrato.caucao)

  return (
    <>
      <BarraImpressao>
        <Link href={`/locacao/${contratoId}`} className="botao botao-neutro">
          Voltar
        </Link>
        <BotaoImprimir />
      </BarraImpressao>

      <Documento
        empresa={empresa}
        titulo={devolvido ? 'Recibo de devolução' : 'Contrato de locação'}
        subtitulo="Locação de equipamentos"
        geradoEm={new Date()}
        cabecalho={
          <BlocoDados
            itens={[
              {
                rotulo: 'Locatário',
                valor: contrato.uso_interno
                  ? `${empresa.nome} — uso interno (${contrato.obra_nome ?? 'obra'})`
                  : contrato.cliente_nome ?? '—',
              },
              { rotulo: 'Data de saída', valor: formatarData(contrato.data_saida) },
              {
                rotulo: 'Devolução prevista',
                valor: contrato.data_prevista ? formatarData(contrato.data_prevista) : '—',
              },
              {
                rotulo: 'Devolução efetiva',
                valor: contrato.data_devolucao ? formatarData(contrato.data_devolucao) : 'em aberto',
              },
            ]}
          />
        }
      >
        <table className="tabela">
          <thead>
            <tr>
              <th>Equipamento</th>
              <th className="num">Qtd.</th>
              <th className="num">Período</th>
              <th className="num">Valor</th>
            </tr>
          </thead>
          <tbody>
            {a.itens.map((linha) => (
              <tr key={linha.item.id}>
                <td>{linha.item.descricao}</td>
                <td className="num">{linha.item.quantidade}</td>
                <td className="num">{a.detalhe_previsto}</td>
                <td className="num">{formatarMoeda(linha.valor_previsto)}</td>
              </tr>
            ))}
            <tr className="subtotal">
              <td colSpan={3}>Período contratado — {a.dias_previstos} dia(s)</td>
              <td className="num">{formatarMoeda(a.valor_previsto)}</td>
            </tr>
            {a.valor_adicional > 0 && (
              <tr className="subtotal">
                <td colSpan={3}>
                  Diárias adicionais — {a.dias_adicionais} dia(s) além do previsto
                </td>
                <td className="num">{formatarMoeda(a.valor_adicional)}</td>
              </tr>
            )}
            {contrato.caucao > 0 && (
              <tr>
                <td colSpan={3}>Caução recebida</td>
                <td className="num">− {formatarMoeda(contrato.caucao)}</td>
              </tr>
            )}
            <tr className="total">
              <td colSpan={3}>{devolvido ? 'Valor pago' : 'Valor do contrato'}</td>
              <td className="num">{formatarMoeda(saldo)}</td>
            </tr>
          </tbody>
        </table>

        {contrato.forma_pagamento && (
          <p className="mt-2 text-[10px]">
            <strong>Forma de pagamento:</strong> {contrato.forma_pagamento}
          </p>
        )}

        {contrato.observacao && (
          <p className="mt-1 text-[10px]">
            <strong>Observação:</strong> {contrato.observacao}
          </p>
        )}

        <div className="mt-4 text-[10px] leading-relaxed">
          <strong className="block uppercase text-rv-900 mb-1">Condições</strong>
          <p>
            1. O locatário recebe os equipamentos em perfeito estado de uso e se obriga a devolvê-los
            nas mesmas condições, ressalvado o desgaste natural.
          </p>
          <p>
            2. A devolução após a data prevista acarreta a cobrança de diárias adicionais, conforme a
            tabela vigente.
          </p>
          <p>
            3. Avarias, perdas ou falta de peças são de responsabilidade do locatário, e o valor do
            reparo ou reposição pode ser descontado da caução.
          </p>
          <p>4. O equipamento não pode ser sublocado nem transferido a terceiros.</p>
        </div>

        {devolvido && (
          <p className="mt-3 text-[11px]">
            Os equipamentos acima foram devolvidos em{' '}
            <strong>{formatarData(contrato.data_devolucao!)}</strong>, e o valor de{' '}
            <strong>{formatarMoeda(saldo)}</strong> foi quitado, dando-se plena quitação.
          </p>
        )}

        <div className="mt-8 grid grid-cols-2 gap-8 text-center text-[11px]">
          <div className="border-t border-slate-700 pt-1">
            {contrato.uso_interno ? empresa.nome : contrato.cliente_nome ?? ''}
            <div className="text-[10px] text-slate-600">Locatário</div>
          </div>
          <div className="border-t border-slate-700 pt-1">
            {empresa.responsavel}
            <div className="text-[10px] text-slate-600">
              {empresa.responsavel_titulo} — {empresa.crea}
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-[10px] text-slate-600">
          Teresina/PI, {formatarData(hojeISO())}
        </p>
      </Documento>
    </>
  )
}
