import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { carregarFechamentoDebitos } from '@/lib/dados/fechamento'
import { listarNotas } from '@/lib/dados/notas'
import { carregarParametros, dadosEmpresa, texto } from '@/lib/parametros'
import { colunasDoRelatorio, versaoDaQuery, versaoParaCliente } from '@/lib/domain/versoes-exibicao'
import { Documento, BlocoDados, BarraImpressao } from '@/components/documento'
import { BotaoImprimir } from '@/components/botao-imprimir'
import { formatarData, formatarMoeda, formatarNumero, hojeISO } from '@/lib/format'
import type { Agrupamento } from '@/lib/domain/fechamento-debitos'

const TEXTO_COMPOSICAO =
  'A composição do custo desta obra concentra-se em material e locação de equipamentos, ' +
  'que respondem pela maior parte do valor. A mão de obra é a menor parcela do total.'

/**
 * Relatorio de Servicos Prestados — fechamento de servicos (spec 4.12), com as
 * versoes de exibicao do item 4.14. O documento e do cliente: BDI e margem
 * ficam desligados a forca (regra 11.1).
 */
export default async function RelatorioFechamento({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { obraId } = await params
  const query = await searchParams
  await exigirAdmin()

  const agrupamento: Agrupamento = query.agrupar === 'local' ? 'local' : 'grupo'
  const versao = versaoParaCliente(versaoDaQuery(query))

  const [obra, parametros] = await Promise.all([carregarObra(obraId), carregarParametros()])
  if (!obra) notFound()

  const { fechamento: f } = await carregarFechamentoDebitos(obraId, agrupamento)
  const notas = await listarNotas(obraId, {})
  const notasRv = notas.filter((n) => n.pago_por === 'rv')
  const empresa = dadosEmpresa(parametros)
  const cliente = obra.pagador ?? obra.cliente

  const semValor = versao.versao_pedreiro
  const col = colunasDoRelatorio(versao)
  const mostrarQuantidade = col.quantidade
  const mostrarUnitario = col.preco_unitario
  const colunas = col.total

  const dadosCabecalho = [
    { rotulo: 'Cliente', valor: cliente?.nome ?? '—' },
    { rotulo: 'Obra', valor: obra.nome },
    ...(versao.mostrar_cnpj_cliente && cliente?.documento
      ? [{ rotulo: 'CPF/CNPJ', valor: cliente.documento }]
      : []),
    { rotulo: 'Local', valor: obra.endereco ?? '—' },
    { rotulo: 'Data', valor: formatarData(hojeISO()) },
    ...(versao.mostrar_numero_documento
      ? [{ rotulo: 'Documento', valor: `FS-${obraId.slice(0, 8).toUpperCase()}` }]
      : []),
  ]

  return (
    <>
      <BarraImpressao>
        <Link href={`/obras/${obraId}/fechamento`} className="botao botao-neutro">
          Voltar
        </Link>
        <BotaoImprimir />
        <span className="text-[11px] text-rv-100">
          {semValor
            ? 'Versão para o pedreiro — sem valores'
            : versao.mostrar_preco_unitario
              ? 'Com preço unitário'
              : 'Sem preço unitário'}
        </span>
      </BarraImpressao>

      <Documento
        empresa={empresa}
        titulo="Relatório de Serviços Prestados"
        subtitulo="Fechamento de serviços"
        geradoEm={new Date()}
        cabecalho={<BlocoDados itens={dadosCabecalho} />}
      >
        {/* 1. Serviços executados, agrupados, com subtotal por grupo */}
        <table className="tabela">
          <thead>
            <tr>
              <th>Serviço</th>
              {mostrarQuantidade && <th className="num">Quantidade</th>}
              {mostrarUnitario && <th className="num">Preço unit.</th>}
              {!semValor && <th className="num">Valor</th>}
            </tr>
          </thead>
          <tbody>
            {f.grupos.map((g) => (
              <Grupo
                key={g.grupo}
                grupo={g}
                colunas={colunas}
                semValor={semValor}
                mostrarQuantidade={mostrarQuantidade}
                mostrarUnitario={mostrarUnitario}
                agruparValorUnico={versao.agrupar_valor_unico}
              />
            ))}
            {!semValor && (
              <tr className="total">
                <td colSpan={colunas - 1}>Total dos serviços executados</td>
                <td className="num">{formatarMoeda(f.servicos_liquidos)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {!semValor && (
          <>
            {/* 2. Deduções */}
            {f.esclarecimentos.length > 0 && (
              <table className="tabela mt-3">
                <thead>
                  <tr>
                    <th colSpan={2}>Deduções — itens não executados ou executados parcialmente</th>
                  </tr>
                </thead>
                <tbody>
                  {f.esclarecimentos.map((e, i) => (
                    <tr key={i}>
                      <td>{e.descricao}</td>
                      <td className="num">− {formatarMoeda(e.valor)}</td>
                    </tr>
                  ))}
                  <tr className="subtotal">
                    <td>Total deduzido</td>
                    <td className="num">− {formatarMoeda(f.total_deducoes)}</td>
                  </tr>
                </tbody>
              </table>
            )}

            {/* 3. Adiantamentos recebidos */}
            {f.adiantamentos.length > 0 && (
              <table className="tabela mt-3">
                <thead>
                  <tr>
                    <th>Adiantamentos recebidos</th>
                    <th>Data</th>
                    <th>Forma</th>
                    <th className="num">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {f.adiantamentos.map((a) => (
                    <tr key={a.id}>
                      <td>
                        Parcela {a.numero_parcela}
                        {a.valor_outro_contrato > 0 && (
                          <div className="text-[10px] text-slate-600">
                            Do valor de {formatarMoeda(a.valor_recebido)} recebido,{' '}
                            {formatarMoeda(a.valor_outro_contrato)} referem-se a outro contrato.
                          </div>
                        )}
                        {a.observacao && (
                          <div className="text-[10px] text-slate-600">{a.observacao}</div>
                        )}
                      </td>
                      <td>{a.data_recebimento ? formatarData(a.data_recebimento) : '—'}</td>
                      <td>{a.forma_pagamento ?? '—'}</td>
                      <td className="num">
                        {formatarMoeda(a.valor_recebido - a.valor_outro_contrato)}
                      </td>
                    </tr>
                  ))}
                  <tr className="subtotal">
                    <td colSpan={3}>Total recebido nesta obra</td>
                    <td className="num">{formatarMoeda(f.total_adiantamentos)}</td>
                  </tr>
                </tbody>
              </table>
            )}

            {/* 4. Notas fiscais a repassar */}
            {notasRv.length > 0 && (
              <table className="tabela mt-3">
                <thead>
                  <tr>
                    <th>Notas fiscais a repassar</th>
                    <th>Data</th>
                    <th className="num">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {versao.agrupar_valor_unico ? (
                    <tr>
                      <td colSpan={2}>{notasRv.length} nota(s) fiscal(is) de material e serviços</td>
                      <td className="num">{formatarMoeda(f.notas_a_repassar)}</td>
                    </tr>
                  ) : (
                    notasRv.map((n) => (
                      <tr key={n.id}>
                        <td>
                          {n.fornecedor_nome || '—'}
                          {n.descricao && (
                            <span className="text-[10px] text-slate-600"> · {n.descricao}</span>
                          )}
                        </td>
                        <td>{formatarData(n.data)}</td>
                        <td className="num">{formatarMoeda(n.valor)}</td>
                      </tr>
                    ))
                  )}
                  <tr className="subtotal">
                    <td colSpan={2}>Total das notas a repassar</td>
                    <td className="num">{formatarMoeda(f.notas_a_repassar)}</td>
                  </tr>
                </tbody>
              </table>
            )}

            {/* 5 e 6. Material do almoxarifado e saldo devedor */}
            <table className="tabela mt-3">
              <tbody>
                <tr className="secao">
                  <td colSpan={2}>Fechamento</td>
                </tr>
                <tr>
                  <td>Serviços executados, já deduzidos</td>
                  <td className="num">{formatarMoeda(f.servicos_liquidos)}</td>
                </tr>
                <tr>
                  <td>Adiantamentos recebidos</td>
                  <td className="num">− {formatarMoeda(f.total_adiantamentos)}</td>
                </tr>
                <tr>
                  <td>Notas fiscais a repassar</td>
                  <td className="num">+ {formatarMoeda(f.notas_a_repassar)}</td>
                </tr>
                {f.almoxarifado_cobrado > 0 && (
                  <tr>
                    <td>Material da RV utilizado na obra</td>
                    <td className="num">+ {formatarMoeda(f.almoxarifado_cobrado)}</td>
                  </tr>
                )}
                <tr className="total">
                  <td>Saldo devedor</td>
                  <td className="num">{formatarMoeda(f.saldo_devedor)}</td>
                </tr>
              </tbody>
            </table>

            {/* Esclarecimentos ao final */}
            {f.esclarecimentos.length > 0 && (
              <div className="mt-3">
                <h2 className="text-[11px] font-bold uppercase text-rv-900 mb-1">Esclarecimentos</h2>
                <ul className="text-[10px] list-disc pl-4 space-y-0.5">
                  {f.esclarecimentos.map((e, i) => (
                    <li key={i}>
                      <strong>{e.descricao}:</strong> {formatarMoeda(e.valor)} deduzidos.{' '}
                      {e.justificativa}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {versao.destacar_composicao_custo && (
              <p className="mt-3 rounded border border-rv-600 bg-rv-50 px-2 py-1.5 text-[10px]">
                {TEXTO_COMPOSICAO}
              </p>
            )}

            {versao.mostrar_prazo_execucao && (
              <p className="mt-2 text-[10px] text-slate-600">
                {texto(parametros, 'texto_prazo_execucao')}
              </p>
            )}
          </>
        )}

        {semValor && (
          <p className="mt-3 text-[10px] text-slate-600">
            Relação de serviços para execução. Documento sem valores.
          </p>
        )}
      </Documento>

      {/* 7. Anexo com as fotos das notas */}
      {!semValor &&
        notasRv
          .filter((n) => n.fotos.length > 0)
          .map((n) => (
            <div key={n.id} className="quebra-pagina">
              <Documento
                empresa={empresa}
                titulo="Anexo — nota fiscal"
                subtitulo={`${formatarData(n.data)} · ${n.fornecedor_nome || 'sem fornecedor'}`}
                assinar={false}
                cabecalho={
                  <BlocoDados
                    itens={[
                      { rotulo: 'Fornecedor', valor: n.fornecedor_nome || '—' },
                      { rotulo: 'Nota', valor: n.numero_nota ?? '—' },
                      { rotulo: 'Data', valor: formatarData(n.data) },
                      { rotulo: 'Valor', valor: formatarMoeda(n.valor) },
                    ]}
                  />
                }
              >
                <div className="grid gap-2">
                  {n.fotos.map((foto) =>
                    foto.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={foto.caminho}
                        src={foto.url}
                        alt={`Nota ${n.numero_nota ?? ''}`}
                        className="w-full max-h-[190mm] object-contain border border-slate-300"
                      />
                    ) : null,
                  )}
                </div>
              </Documento>
            </div>
          ))}
    </>
  )
}

function Grupo({
  grupo,
  colunas,
  semValor,
  mostrarQuantidade,
  mostrarUnitario,
  agruparValorUnico,
}: {
  grupo: import('@/lib/domain/fechamento-debitos').GrupoServicos
  colunas: number
  semValor: boolean
  mostrarQuantidade: boolean
  mostrarUnitario: boolean
  agruparValorUnico: boolean
}) {
  // "Agrupar itens em valor único por grupo": o grupo vira uma linha só.
  if (agruparValorUnico && !semValor) {
    return (
      <tr>
        <td colSpan={colunas - 1}>{grupo.grupo}</td>
        <td className="num">{formatarMoeda(grupo.subtotal)}</td>
      </tr>
    )
  }

  return (
    <>
      <tr className="secao">
        <td colSpan={colunas}>{grupo.grupo}</td>
      </tr>
      {grupo.servicos
        .filter((s) => semValor || s.valor_liquido > 0)
        .map((s) => (
          <tr key={s.id}>
            <td>{s.descricao}</td>
            {mostrarQuantidade && (
              <td className="num">
                {s.quantidade ? `${formatarNumero(s.quantidade)} ${s.unidade ?? ''}` : '—'}
              </td>
            )}
            {mostrarUnitario && (
              <td className="num">{s.preco_unitario ? formatarMoeda(s.preco_unitario) : '—'}</td>
            )}
            {!semValor && <td className="num">{formatarMoeda(s.valor_liquido)}</td>}
          </tr>
        ))}
      {!semValor && (
        <tr className="subtotal">
          <td colSpan={colunas - 1}>Subtotal {grupo.grupo}</td>
          <td className="num">{formatarMoeda(grupo.subtotal)}</td>
        </tr>
      )}
    </>
  )
}
