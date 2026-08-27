import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarCotacao, listarCotacoes } from '@/lib/dados/cotacoes'
import { criarClienteServidor } from '@/lib/supabase/server'
import { compararCotacoes, situacaoDoPreco } from '@/lib/domain/cotacoes'
import { carregarParametros, numero } from '@/lib/parametros'
import { custoPorUnidade } from '@/lib/domain/orcamento'
import { TituloPagina, Cartao, Indicador, Vazio, Etiqueta, Moeda } from '@/components/ui'
import { formatarData, formatarMoeda, formatarNumero, hojeISO } from '@/lib/format'
import { FormularioItemCotacao, FormularioImportacaoItens } from '../formulario'
import { arquivarItemCotacao, alternarBase } from '../acoes'

export default async function DetalheCotacao({
  params,
  searchParams,
}: {
  params: Promise<{ cotacaoId: string }>
  searchParams: Promise<{ comparar?: string; area?: string }>
}) {
  const { cotacaoId } = await params
  const { comparar, area } = await searchParams
  await exigirAdmin()

  const [dados, parametros] = await Promise.all([carregarCotacao(cotacaoId), carregarParametros()])
  if (!dados) notFound()

  const { cotacao, itens, total_calculado } = dados
  const hoje = hojeISO()
  const situacao = situacaoDoPreco(cotacao, hoje, numero(parametros, 'cotacao_dias_alerta', 30))
  const margem = numero(parametros, 'margem_padrao', 0.3)

  // Comparativo lado a lado com outra cotacao do mesmo escopo
  const outras = (await listarCotacoes()).filter((c) => c.id !== cotacaoId)
  const outra = comparar ? outras.find((c) => c.id === comparar) : null
  let comparativo: ReturnType<typeof compararCotacoes> = []
  if (outra) {
    const supabase = await criarClienteServidor()
    const { data } = await supabase
      .from('itens_cotacao')
      .select(
        'id, cotacao_id, categoria, marca, modelo, especificacao, unidade, quantidade, preco_unitario, estimado, substituido',
      )
      .in('cotacao_id', [cotacaoId, outra.id])
      .is('excluido_em', null)

    comparativo = compararCotacoes(
      [cotacao, outra],
      (data ?? []).map((i) => ({
        ...i,
        quantidade: i.quantidade === null ? null : Number(i.quantidade),
        preco_unitario: Number(i.preco_unitario ?? 0),
      })) as Parameters<typeof compararCotacoes>[1],
    )
  }

  // Apuracao do custo por unidade a partir da cotacao base (spec 6.2)
  const areaInformada = area ? Number(area.replace(',', '.')) : null
  const apuracao =
    areaInformada && areaInformada > 0
      ? custoPorUnidade(total_calculado, areaInformada, margem)
      : null

  return (
    <>
      <TituloPagina
        titulo={cotacao.fornecedor_nome}
        subtitulo={
          <>
            Cotação {cotacao.numero_documento ?? 'sem número'} · {formatarData(cotacao.data)}
            {cotacao.base && <span className="ml-2 etiqueta etiqueta-ok">cotação base</span>}
          </>
        }
        acoes={
          <Link href="/cadastros/cotacoes" className="botao botao-neutro">
            Voltar à base de preços
          </Link>
        }
      />

      <div className="grid gap-2 sm:grid-cols-4 mb-3">
        <Indicador rotulo="Total dos itens" valor={formatarMoeda(total_calculado)} />
        <Indicador
          rotulo="Total do documento"
          valor={formatarMoeda(cotacao.total)}
          tom={cotacao.total !== total_calculado && cotacao.total > 0 ? 'alerta' : 'ok'}
          detalhe={
            cotacao.total !== total_calculado && cotacao.total > 0
              ? 'diferente da soma dos itens'
              : undefined
          }
        />
        <Indicador
          rotulo="Validade"
          valor={cotacao.validade ? formatarData(cotacao.validade) : '—'}
          tom={situacao === 'vigente' ? 'ok' : situacao === 'antigo' ? 'alerta' : 'erro'}
          detalhe={situacao === 'vigente' ? 'vigente' : situacao === 'antigo' ? 'mais de 30 dias' : 'vencida'}
        />
        <Indicador rotulo="Itens" valor={String(itens.length)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <Cartao
            titulo={`Itens da cotação (${itens.length})`}
            acoes={
              <form action={alternarBase}>
                <input type="hidden" name="id" value={cotacaoId} />
                <input type="hidden" name="base" value={String(cotacao.base)} />
                <button className="text-white underline text-xs" type="submit">
                  {cotacao.base ? 'tirar de base' : 'marcar como base'}
                </button>
              </form>
            }
          >
            {itens.length === 0 ? (
              <Vazio>Nenhum item. Lance ao lado, ou importe por CSV.</Vazio>
            ) : (
              <div className="overflow-x-auto">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Categoria</th>
                      <th>Produto</th>
                      <th>Un.</th>
                      <th className="num">Qtd.</th>
                      <th className="num">Preço unit.</th>
                      <th className="num">Total</th>
                      <th className="w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((i) => (
                      <tr key={i.id}>
                        <td>{i.categoria ?? '—'}</td>
                        <td>
                          {[i.marca, i.modelo, i.especificacao].filter(Boolean).join(' ') || '—'}
                          {i.estimado && <span className="ml-2 etiqueta etiqueta-alerta">estimado</span>}
                          {i.substituido && (
                            <span className="ml-2 etiqueta etiqueta-alerta">substituído</span>
                          )}
                        </td>
                        <td>{i.unidade ?? '—'}</td>
                        <td className="num">
                          {i.quantidade === null ? '—' : formatarNumero(i.quantidade)}
                        </td>
                        <td className="num">
                          <Moeda valor={i.preco_unitario} />
                        </td>
                        <td className="num">
                          <Moeda valor={Math.round((i.quantidade ?? 1) * i.preco_unitario)} />
                        </td>
                        <td>
                          <form action={arquivarItemCotacao}>
                            <input type="hidden" name="id" value={i.id} />
                            <input type="hidden" name="cotacao_id" value={cotacaoId} />
                            <button className="text-erro-700 underline text-xs" type="submit">
                              remover
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                    <tr className="total">
                      <td colSpan={5}>Total dos itens</td>
                      <td className="num">{formatarMoeda(total_calculado)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Cartao>

          {cotacao.base && (
            <Cartao titulo="Apuração do custo por unidade (spec 6.2)">
              <form method="get" className="flex flex-wrap items-end gap-2 mb-3">
                {comparar && <input type="hidden" name="comparar" value={comparar} />}
                <label className="block">
                  <span className="rotulo">Quantidade do serviço (m², m, un)</span>
                  <input
                    className="campo w-40"
                    name="area"
                    inputMode="decimal"
                    defaultValue={area ?? ''}
                    placeholder="101,94"
                  />
                </label>
                <button className="botao botao-primario" type="submit">
                  Apurar
                </button>
              </form>

              {apuracao && (
                <table className="tabela">
                  <tbody>
                    <tr>
                      <td>Custo do material (cotação base)</td>
                      <td className="num">{formatarMoeda(total_calculado)}</td>
                    </tr>
                    <tr>
                      <td>Custo por unidade</td>
                      <td className="num">{formatarMoeda(apuracao.custo_unitario)}</td>
                    </tr>
                    <tr className="total">
                      <td>Preço de venda sugerido (margem de {(margem * 100).toFixed(0)}%)</td>
                      <td className="num">{formatarMoeda(apuracao.preco_sugerido)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
              <p className="mt-2 text-[11px] text-slate-500">
                Some a mão de obra do terceiro ao custo do material para chegar ao custo total do
                serviço.
              </p>
            </Cartao>
          )}

          {outras.length > 0 && (
            <Cartao titulo="Comparativo com outra cotação">
              <form method="get" className="flex flex-wrap items-end gap-2 mb-3">
                {area && <input type="hidden" name="area" value={area} />}
                <label className="block">
                  <span className="rotulo">Comparar com</span>
                  <select className="campo" name="comparar" defaultValue={comparar ?? ''}>
                    <option value="">— selecione —</option>
                    {outras.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fornecedor_nome} — {formatarData(c.data)}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="botao botao-primario" type="submit">
                  Comparar
                </button>
              </form>

              {outra && comparativo.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th>Produto</th>
                        <th className="num">{cotacao.fornecedor_nome}</th>
                        <th className="num">{outra.fornecedor_nome}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparativo.map((c) => (
                        <tr key={c.chave}>
                          <td>{c.descricao || c.chave}</td>
                          {c.precos.map((p, i) => (
                            <td
                              key={i}
                              className={`num ${c.indice_menor === i ? 'font-bold text-ok-700' : ''}`}
                            >
                              {p === null ? '—' : formatarMoeda(p)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Em verde, o menor preço de cada produto.
                  </p>
                </div>
              )}
            </Cartao>
          )}
        </div>

        <div className="space-y-3">
          <Cartao titulo="Novo item">
            <FormularioItemCotacao cotacaoId={cotacaoId} />
          </Cartao>
          <Cartao titulo="Entrada rápida por CSV">
            <FormularioImportacaoItens cotacaoId={cotacaoId} />
          </Cartao>
        </div>
      </div>
    </>
  )
}
