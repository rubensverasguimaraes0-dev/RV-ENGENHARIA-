import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { listarParcelas } from '@/lib/dados/pagamentos'
import { resumirCronograma, statusDaParcela, valorEfetivo } from '@/lib/domain/pagamentos'
import { TituloPagina, Cartao, Indicador, Etiqueta, Vazio, Moeda } from '@/components/ui'
import { formatarData, formatarMoeda, hojeISO } from '@/lib/format'
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

      <div className="grid gap-2 sm:grid-cols-4 mb-3">
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
            <div className="rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Parcela</th>
                    <th>Prevista</th>
                    <th className="num">Valor previsto</th>
                    <th>Recebida</th>
                    <th className="num">Valor recebido</th>
                    <th className="num">Nesta obra</th>
                    <th>Situação</th>
                    <th className="w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {parcelas.map((p) => {
                    const st = statusDaParcela(p, hoje)
                    return (
                      <tr key={p.id}>
                        <td className="font-semibold">
                          {p.numero_parcela}
                          {p.balao && <span className="ml-1 etiqueta etiqueta-neutra">balão</span>}
                        </td>
                        <td>{p.data_prevista ? formatarData(p.data_prevista) : '—'}</td>
                        <td className="num">
                          <Moeda valor={p.valor_previsto} />
                        </td>
                        <td>
                          {p.data_recebimento ? formatarData(p.data_recebimento) : '—'}
                          {p.forma_pagamento && (
                            <div className="text-[10px] text-slate-500">{p.forma_pagamento}</div>
                          )}
                        </td>
                        <td className="num">
                          {p.valor_recebido === null ? '—' : <Moeda valor={p.valor_recebido} />}
                        </td>
                        <td className="num">
                          {p.valor_recebido === null ? (
                            '—'
                          ) : (
                            <>
                              <Moeda valor={valorEfetivo(p)} />
                              {p.valor_outro_contrato > 0 && (
                                <div className="text-[10px] text-alerta-700">
                                  −{formatarMoeda(p.valor_outro_contrato)} outro contrato
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        <td>
                          {st === 'paga' && <Etiqueta tom="ok">Paga</Etiqueta>}
                          {st === 'prevista' && <Etiqueta tom="neutra">Prevista</Etiqueta>}
                          {st === 'atrasada' && <Etiqueta tom="erro">Atrasada</Etiqueta>}
                          {p.comprovante_assinado && (
                            <a
                              href={p.comprovante_assinado}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-[10px] text-rv-700 underline"
                            >
                              comprovante
                            </a>
                          )}
                        </td>
                        <td className="whitespace-nowrap text-xs">
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
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="total">
                    <td colSpan={2}>Total</td>
                    <td className="num">{formatarMoeda(resumo.total_previsto)}</td>
                    <td></td>
                    <td className="num">{formatarMoeda(resumo.total_recebido)}</td>
                    <td className="num">{formatarMoeda(resumo.total_recebido_nesta_obra)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
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
