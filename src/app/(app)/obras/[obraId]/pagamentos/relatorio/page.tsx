import { Fragment } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { listarParcelas } from '@/lib/dados/pagamentos'
import { carregarParametros, dadosEmpresa } from '@/lib/parametros'
import {
  agruparPorMes,
  parcelasParaAnexar,
  resumirCronograma,
  statusDaParcela,
  valorEfetivo,
} from '@/lib/domain/pagamentos'
import { Documento, BlocoDados, BarraImpressao } from '@/components/documento'
import { PainelIndicadores } from '@/components/painel-indicadores'
import { BotaoImprimir } from '@/components/botao-imprimir'
import { formatarData, formatarMoeda, formatarPercentual, hojeISO } from '@/lib/format'

/**
 * Cronograma em PDF com os comprovantes anexados ao final, mostrando
 * previsto x pago x saldo (spec 4.9).
 */
export default async function RelatorioCronograma({
  params,
}: {
  params: Promise<{ obraId: string }>
}) {
  const { obraId } = await params
  await exigirAdmin()

  const [obra, parametros] = await Promise.all([carregarObra(obraId), carregarParametros()])
  if (!obra) notFound()

  const parcelas = await listarParcelas(obraId)
  const hoje = hojeISO()
  const resumo = resumirCronograma(parcelas, obra.valor_contrato, hoje)
  const empresa = dadosEmpresa(parametros)
  const cliente = obra.pagador ?? obra.cliente
  const comComprovante = parcelasParaAnexar(parcelas)
  const meses = agruparPorMes(parcelas)

  return (
    <>
      <BarraImpressao>
        <Link href={`/obras/${obraId}/pagamentos`} className="botao botao-neutro">
          Voltar
        </Link>
        <BotaoImprimir />
      </BarraImpressao>

      <Documento
        empresa={empresa}
        titulo="Cronograma de pagamentos"
        subtitulo="Previsto x pago x saldo"
        geradoEm={new Date()}
        cabecalho={
          <BlocoDados
            itens={[
              { rotulo: 'Cliente', valor: cliente?.nome ?? '—' },
              { rotulo: 'Obra', valor: obra.nome },
              { rotulo: 'Contrato', valor: formatarMoeda(obra.valor_contrato) },
              { rotulo: 'Local', valor: obra.endereco ?? '—' },
            ]}
          />
        }
      >
        <PainelIndicadores
          itens={[
            { rotulo: 'Valor do contrato', valor: formatarMoeda(obra.valor_contrato) },
            {
              rotulo: 'Total pago',
              valor: formatarMoeda(resumo.total_recebido_nesta_obra),
              tom: 'pago',
            },
            { rotulo: 'Saldo a pagar', valor: formatarMoeda(resumo.saldo_contrato), tom: 'saldo' },
            { rotulo: 'Quitado', valor: formatarPercentual(resumo.percentual_quitado, 1) },
          ]}
        />

        <table className="tabela">
          <thead>
            <tr>
              <th>Parcela</th>
              <th>Data prevista</th>
              <th className="num">Previsto</th>
              <th>Data do pagamento</th>
              <th>Forma</th>
              <th className="num">Pago</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((mes) => (
              <Fragment key={mes.chave || 'sem-vencimento'}>
                <tr className="secao">
                  <td colSpan={2}>{mes.rotulo}</td>
                  <td className="num">{formatarMoeda(mes.previsto)}</td>
                  <td colSpan={2}></td>
                  <td className="num">{mes.recebido > 0 ? formatarMoeda(mes.recebido) : ''}</td>
                </tr>
                {mes.parcelas.map((p) => {
                  const st = statusDaParcela(p, hoje)
                  return (
                    <tr key={p.id} className={st === 'paga' ? 'quitada' : st === 'atrasada' ? 'atrasada' : ''}>
                      <td>
                        {p.numero_parcela}
                        {p.balao ? ' (saldo)' : ''}
                      </td>
                      <td>{p.data_prevista ? formatarData(p.data_prevista) : '—'}</td>
                      <td className="num">{formatarMoeda(p.valor_previsto)}</td>
                      <td>
                        {p.data_recebimento
                          ? formatarData(p.data_recebimento)
                          : st === 'atrasada'
                            ? 'em atraso'
                            : '—'}
                      </td>
                      <td>{p.forma_pagamento ?? '—'}</td>
                      <td className="num">
                        {p.valor_recebido === null ? '—' : formatarMoeda(valorEfetivo(p))}
                      </td>
                    </tr>
                  )
                })}
              </Fragment>
            ))}
            <tr className="subtotal">
              <td colSpan={2}>Total previsto</td>
              <td className="num">{formatarMoeda(resumo.total_previsto)}</td>
              <td colSpan={2}>Total pago nesta obra</td>
              <td className="num">{formatarMoeda(resumo.total_recebido_nesta_obra)}</td>
            </tr>
            <tr className="total">
              <td colSpan={5}>Saldo do contrato</td>
              <td className="num">{formatarMoeda(resumo.saldo_contrato)}</td>
            </tr>
          </tbody>
        </table>

        {parcelas.some((p) => p.valor_outro_contrato > 0 || p.observacao) && (
          <div className="mt-3">
            <h2 className="text-[11px] font-bold uppercase text-rv-900 mb-1">Observações</h2>
            <ul className="text-[11px] list-disc pl-4 space-y-0.5">
              {parcelas
                .filter((p) => p.valor_outro_contrato > 0 || p.observacao)
                .map((p) => (
                  <li key={p.id}>
                    <strong>Parcela {p.numero_parcela}:</strong>{' '}
                    {p.valor_outro_contrato > 0 && (
                      <>
                        do valor de {formatarMoeda(p.valor_recebido ?? 0)} recebido,{' '}
                        {formatarMoeda(p.valor_outro_contrato)} referem-se a outro contrato e não
                        foram considerados nesta obra.{' '}
                      </>
                    )}
                    {p.observacao}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </Documento>

      {comComprovante.map((p) => (
        <div key={p.id} className="quebra-pagina">
          <Documento
            empresa={empresa}
            titulo="Anexo — comprovante de pagamento"
            subtitulo={`Parcela ${p.numero_parcela}`}
            assinar={false}
            cabecalho={
              <BlocoDados
                itens={[
                  { rotulo: 'Parcela', valor: String(p.numero_parcela) },
                  {
                    rotulo: 'Data',
                    valor: p.data_recebimento ? formatarData(p.data_recebimento) : '—',
                  },
                  { rotulo: 'Valor', valor: formatarMoeda(p.valor_recebido ?? 0) },
                  { rotulo: 'Forma', valor: p.forma_pagamento ?? '—' },
                ]}
              />
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.comprovante_assinado!}
              alt={`Comprovante da parcela ${p.numero_parcela}`}
              className="w-full max-h-[190mm] object-contain border border-slate-300"
            />
          </Documento>
        </div>
      ))}
    </>
  )
}
