import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { listarParcelas } from '@/lib/dados/pagamentos'
import { resumirCronograma, statusDaParcela, valorEfetivo } from '@/lib/domain/pagamentos'
import { TituloPagina, Cartao, Indicador, Etiqueta, Vazio } from '@/components/ui'
import { TabelaFicha } from '@/components/tabela-ficha'
import type { StatusParcela } from '@/lib/domain/tipos'
import { formatarData, formatarMoeda, formatarPercentual, hojeISO } from '@/lib/format'
import { FormularioParcela, FormularioRecebimento } from './formulario'
import { arquivarParcela } from './acoes'

export default async function PaginaPagamentos({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>
  searchParams: Promise<{ receber?: string }>
}) {
  const { obraId } = await params
  const { receber } = await searchParams
  await exigirAdmin()

  const obra = await carregarObra(obraId)
  if (!obra) notFound()

  const parcelas = await listarParcelas(obraId)
  const hoje = hojeISO()
  const resumo = resumirCronograma(parcelas, obra.valor_contrato, hoje)
  const emRecebimento = receber ? parcelas.find((p) => p.id === receber) ?? null : null
  const proximoNumero = Math.max(0, ...parcelas.map((p) => p.numero_parcela)) + 1

  return (
    <>
      <TituloPagina
        titulo="Cronograma de pagamentos"
        subtitulo={`${obra.nome} · ${(obra.pagador ?? obra.cliente)?.nome ?? ''}`}
        acoes={
          <>
            <Link href={`/obras/${obraId}/pagamentos/relatorio`} className="botao botao-primario">
              Cronograma (PDF)
            </Link>
            <Link href={`/obras/${obraId}`} className="botao botao-neutro">
              Voltar à obra
            </Link>
          </>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 mb-3">
        <Indicador rotulo="Contrato" valor={formatarMoeda(obra.valor_contrato)} />
        <Indicador
          rotulo="Recebido nesta obra"
          valor={formatarMoeda(resumo.total_recebido_nesta_obra)}
          tom="ok"
          detalhe={
            resumo.total_outro_contrato > 0
              ? `${formatarMoeda(resumo.total_outro_contrato)} eram de outro contrato`
              : undefined
          }
        />
        <Indicador
          rotulo="Saldo"
          valor={formatarMoeda(resumo.saldo_contrato)}
          tom={resumo.saldo_contrato > 0 ? 'alerta' : 'ok'}
        />
        <Indicador
          rotulo="Quitado"
          valor={formatarPercentual(resumo.percentual_quitado, 1)}
          detalhe={obra.valor_contrato === 0 ? 'obra sem valor de contrato' : undefined}
        />
        <Indicador
          rotulo="Parcelas atrasadas"
          valor={String(resumo.parcelas_atrasadas)}
          tom={resumo.parcelas_atrasadas > 0 ? 'erro' : 'ok'}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <Cartao titulo={`Parcelas (${parcelas.length})`}>
          {parcelas.length === 0 ? (
            <Vazio>Nenhuma parcela cadastrada. Comece pelos adiantamentos combinados.</Vazio>
          ) : (
            <TabelaFicha
              itens={parcelas}
              chave={(p) => p.id}
              rodape={
                <tr className="total">
                  <td colSpan={2}>Total</td>
                  <td className="num">{formatarMoeda(resumo.total_previsto)}</td>
                  <td></td>
                  <td className="num">{formatarMoeda(resumo.total_recebido)}</td>
                  <td className="num">{formatarMoeda(resumo.total_recebido_nesta_obra)}</td>
                  <td colSpan={2}></td>
                </tr>
              }
              colunas={[
                {
                  rotulo: 'Parcela',
                  celular: 'titulo',
                  valor: (p) => (
                    <>
                      <span className="font-semibold">Parcela {p.numero_parcela}</span>
                      {p.balao && <span className="ml-1 etiqueta etiqueta-neutra">balão</span>}
                      <span className="block text-[12px] font-normal text-slate-500 lg:hidden">
                        {situacaoEmTexto(statusDaParcela(p, hoje))}
                        {p.data_prevista && ` · vence ${formatarData(p.data_prevista)}`}
                      </span>
                    </>
                  ),
                },
                {
                  rotulo: 'Valor previsto',
                  celular: 'destaque',
                  num: true,
                  tom: (p) => (statusDaParcela(p, hoje) === 'atrasada' ? 'erro' : 'neutro'),
                  valor: (p) => formatarMoeda(p.valor_previsto),
                },
                {
                  rotulo: 'Vencimento',
                  celular: 'escondido',
                  valor: (p) => (p.data_prevista ? formatarData(p.data_prevista) : '—'),
                },
                {
                  rotulo: 'Recebida em',
                  valor: (p) => (
                    <>
                      {p.data_recebimento ? formatarData(p.data_recebimento) : '—'}
                      {p.forma_pagamento && (
                        <span className="text-[11px] text-slate-500 ml-1">
                          {p.forma_pagamento}
                        </span>
                      )}
                    </>
                  ),
                },
                {
                  rotulo: 'Valor recebido',
                  num: true,
                  valor: (p) => (p.valor_recebido === null ? '—' : formatarMoeda(p.valor_recebido)),
                },
                {
                  rotulo: 'Nesta obra',
                  num: true,
                  valor: (p) =>
                    p.valor_recebido === null ? (
                      '—'
                    ) : (
                      <>
                        {formatarMoeda(valorEfetivo(p))}
                        {p.valor_outro_contrato > 0 && (
                          <span className="block text-[10px] text-alerta-700">
                            −{formatarMoeda(p.valor_outro_contrato)} outro contrato
                          </span>
                        )}
                      </>
                    ),
                },
                {
                  rotulo: 'Situação',
                  celular: 'escondido',
                  valor: (p) => {
                    const st = statusDaParcela(p, hoje)
                    return (
                      <>
                        {st === 'paga' && <Etiqueta tom="ok">Paga</Etiqueta>}
                        {st === 'prevista' && <Etiqueta tom="neutra">Prevista</Etiqueta>}
                        {st === 'atrasada' && <Etiqueta tom="erro">Atrasada</Etiqueta>}
                      </>
                    )
                  },
                },
                {
                  rotulo: 'Comprovante',
                  valor: (p) =>
                    p.comprovante_assinado ? (
                      <a
                        href={p.comprovante_assinado}
                        target="_blank"
                        rel="noreferrer"
                        className="acao acao-neutra"
                      >
                        ver comprovante
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    ),
                },
                {
                  rotulo: '',
                  classe: 'w-32',
                  valor: (p) => (
                    <span className="whitespace-nowrap text-xs flex gap-2 lg:justify-start justify-end">
                      <Link
                        href={`/obras/${obraId}/pagamentos?receber=${p.id}`}
                        className="acao acao-neutra"
                      >
                        {p.valor_recebido === null ? 'receber' : 'editar'}
                      </Link>
                      <form action={arquivarParcela} className="inline">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="obra_id" value={obraId} />
                        <button className="acao acao-perigo" type="submit">
                          remover
                        </button>
                      </form>
                    </span>
                  ),
                },
              ]}
            />
          )}

          {parcelas.some((p) => p.observacao) && (
            <ul className="mt-3 text-xs text-slate-600 space-y-1">
              {parcelas
                .filter((p) => p.observacao)
                .map((p) => (
                  <li key={p.id}>
                    <strong>Parcela {p.numero_parcela}:</strong> {p.observacao}
                  </li>
                ))}
            </ul>
          )}
        </Cartao>

        <div className="space-y-3">
          {emRecebimento ? (
            <Cartao titulo={`Recebimento da parcela ${emRecebimento.numero_parcela}`}>
              <FormularioRecebimento obraId={obraId} parcela={emRecebimento} />
              <Link href={`/obras/${obraId}/pagamentos`} className="botao botao-neutro mt-2 w-full">
                Cancelar
              </Link>
            </Cartao>
          ) : (
            <Cartao titulo="Nova parcela">
              <FormularioParcela obraId={obraId} proximoNumero={proximoNumero} />
            </Cartao>
          )}
        </div>
      </div>
    </>
  )
}


/** Situacao por extenso, para a ficha do celular, onde a etiqueta nao cabe. */
function situacaoEmTexto(st: StatusParcela): string {
  return st === 'paga' ? 'Paga' : st === 'atrasada' ? 'Atrasada' : 'Prevista'
}
