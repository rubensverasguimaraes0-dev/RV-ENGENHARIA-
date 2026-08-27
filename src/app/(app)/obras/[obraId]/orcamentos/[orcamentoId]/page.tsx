import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { buscarPrecosReferencia, carregarOrcamento } from '@/lib/dados/orcamento'
import { carregarParametros, texto } from '@/lib/parametros'
import { TituloPagina, Cartao, Indicador, Vazio, Etiqueta, Moeda } from '@/components/ui'
import { formatarMoeda, formatarNumero, formatarPercentual } from '@/lib/format'
import { SeletorVersao } from '@/components/seletor-versao'
import { FormularioCabecalho, FormularioItem } from '../formulario'
import { arquivarItem, importarComposicao } from '../acoes'

export default async function EditorOrcamento({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string; orcamentoId: string }>
  searchParams: Promise<{ editar?: string; buscar?: string }>
}) {
  const { obraId, orcamentoId } = await params
  const { editar, buscar } = await searchParams
  await exigirAdmin()

  const [obra, dados, parametros] = await Promise.all([
    carregarObra(obraId),
    carregarOrcamento(orcamentoId),
    carregarParametros(),
  ])
  if (!obra || !dados) notFound()

  const { orcamento, itens, calculo, pendencias } = dados
  const completo = orcamento.tipo === 'completo'
  const emEdicao = editar ? itens.find((i) => i.id === editar) ?? null : null
  const referencias = completo && buscar !== undefined ? await buscarPrecosReferencia(buscar ?? '') : []

  return (
    <>
      <TituloPagina
        titulo={orcamento.titulo ?? 'Orçamento'}
        subtitulo={
          <>
            {obra.nome} · {completo ? 'orçamento completo' : 'orçamento rápido'}
            {orcamento.numero && ` · nº ${orcamento.numero}`}
          </>
        }
        acoes={
          <>
            <Link
              href={`/api/obras/${obraId}/orcamentos/${orcamentoId}/planilha`}
              className="botao botao-neutro"
            >
              Planilha (xlsx)
            </Link>
            <Link href={`/obras/${obraId}/orcamentos`} className="botao botao-neutro">
              Todos os orçamentos
            </Link>
          </>
        }
      />

      <div className="grid gap-2 sm:grid-cols-4 mb-3">
        <Indicador rotulo="Subtotal dos itens" valor={formatarMoeda(calculo.totais.subtotal)} />
        <Indicador
          rotulo="BDI"
          valor={
            orcamento.modo_bdi === 'sem_bdi'
              ? '—'
              : orcamento.modo_bdi === 'embutido'
                ? 'embutido'
                : formatarMoeda(calculo.totais.valor_bdi)
          }
          detalhe={orcamento.bdi > 0 ? formatarPercentual(orcamento.bdi, 0) : undefined}
        />
        <Indicador rotulo="Total ao cliente" valor={formatarMoeda(calculo.totais.total)} tom="ok" />
        <Indicador
          rotulo="Margem apurada"
          valor={formatarMoeda(calculo.totais.margem_valor)}
          detalhe={`${formatarPercentual(calculo.totais.margem_percentual)} · interno`}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <Cartao titulo={`Itens (${itens.length})`}>
            {itens.length === 0 ? (
              <Vazio>Nenhum item ainda. Adicione ao lado.</Vazio>
            ) : (
              <div className="overflow-x-auto">
                <table className="tabela">
                  <thead>
                    <tr>
                      {completo && <th className="w-16">Fase</th>}
                      <th>Descrição</th>
                      <th>Un.</th>
                      <th className="num">Qtd.</th>
                      <th className="num">Custo unit.</th>
                      <th className="num">Preço unit.</th>
                      <th className="num">Total</th>
                      <th className="w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculo.itens.map((i) => (
                      <tr key={i.id}>
                        {completo && <td className="text-xs">{i.fase ?? '—'}</td>}
                        <td>
                          {i.descricao}
                          {i.base_referencia !== 'proprio' && (
                            <span className="ml-2 etiqueta etiqueta-neutra">
                              {i.base_referencia} {i.codigo_referencia ?? ''}
                            </span>
                          )}
                          {i.terceirizado_sem_valor && (
                            <span className="ml-2 etiqueta etiqueta-alerta">a cotar</span>
                          )}
                        </td>
                        <td>{i.unidade ?? '—'}</td>
                        <td className="num">
                          {i.quantidade === null ? '—' : formatarNumero(i.quantidade)}
                        </td>
                        <td className="num">
                          {i.custo_unitario > 0 ? <Moeda valor={i.custo_unitario} /> : '—'}
                        </td>
                        <td className="num">
                          <Moeda valor={i.preco_exibido_unitario} />
                        </td>
                        <td className="num font-semibold">
                          {i.terceirizado_sem_valor ? (
                            <span className="text-slate-400">a cotar</span>
                          ) : (
                            <Moeda valor={i.total} />
                          )}
                        </td>
                        <td className="whitespace-nowrap text-xs">
                          <Link
                            href={`/obras/${obraId}/orcamentos/${orcamentoId}?editar=${i.id}`}
                            className="text-rv-700 underline"
                          >
                            editar
                          </Link>
                          <form action={arquivarItem} className="inline">
                            <input type="hidden" name="id" value={i.id} />
                            <input type="hidden" name="orcamento_id" value={orcamentoId} />
                            <input type="hidden" name="obra_id" value={obraId} />
                            <button className="text-erro-700 underline ml-1" type="submit">
                              remover
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                    <tr className="subtotal">
                      <td colSpan={completo ? 6 : 5}>Subtotal</td>
                      <td className="num">{formatarMoeda(calculo.totais.subtotal)}</td>
                      <td></td>
                    </tr>
                    {orcamento.modo_bdi === 'visivel' && (
                      <tr className="subtotal">
                        <td colSpan={completo ? 6 : 5}>
                          BDI ({formatarPercentual(orcamento.bdi, 0)})
                        </td>
                        <td className="num">{formatarMoeda(calculo.totais.valor_bdi)}</td>
                        <td></td>
                      </tr>
                    )}
                    <tr className="total">
                      <td colSpan={completo ? 6 : 5}>Total</td>
                      <td className="num">{formatarMoeda(calculo.totais.total)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            {calculo.totais.itens_sem_valor > 0 && (
              <p className="mt-2 text-xs text-alerta-700">
                {calculo.totais.itens_sem_valor} item(ns) a cotar separadamente: aparecem descritos
                no documento, sem preço, e não somam no total.
              </p>
            )}
          </Cartao>

          {completo && calculo.fases.length > 0 && (
            <Cartao titulo="Fases">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Fase</th>
                    <th className="num">Subtotal</th>
                    <th className="num">Custo (interno)</th>
                  </tr>
                </thead>
                <tbody>
                  {calculo.fases.map((f) => (
                    <tr key={f.fase} className={f.nivel === 1 ? 'subtotal' : undefined}>
                      <td style={{ paddingLeft: `${(f.nivel - 1) * 16 + 7}px` }}>
                        <strong>{f.fase}</strong> {f.descricao}
                      </td>
                      <td className="num">
                        <Moeda valor={f.subtotal} />
                      </td>
                      <td className="num">
                        <Moeda valor={f.custo} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Cartao>
          )}

          {pendencias.length > 0 && (
            <Cartao titulo={`Pendências / itens a definir (${pendencias.length})`}>
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {pendencias.map((p) => (
                    <tr key={p.id}>
                      <td>{p.descricao}</td>
                      <td>{p.observacao ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-slate-500">
                Pendências ficam fora do total e saem em aba própria da planilha.
              </p>
            </Cartao>
          )}

          {completo && (
            <Cartao
              titulo="Base de preços referenciais"
              acoes={
                <Link
                  href={`/obras/${obraId}/orcamentos/${orcamentoId}?buscar=`}
                  className="text-white underline text-xs"
                >
                  abrir busca
                </Link>
              }
            >
              <form method="get" className="flex gap-2 mb-2">
                <input
                  className="campo"
                  name="buscar"
                  defaultValue={buscar ?? ''}
                  placeholder="Buscar por descrição ou código (SINAPI, ORSE, SICRO)"
                />
                <button className="botao botao-primario" type="submit">
                  Buscar
                </button>
              </form>

              {buscar !== undefined && referencias.length === 0 && (
                <Vazio>
                  Nada encontrado. Importe as tabelas em{' '}
                  <Link href="/cadastros/precos-referencia" className="text-rv-700 underline">
                    Cadastros → Preços referenciais
                  </Link>
                  .
                </Vazio>
              )}

              {referencias.length > 0 && (
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Base</th>
                      <th>Código</th>
                      <th>Descrição</th>
                      <th>Un.</th>
                      <th className="num">Preço</th>
                      <th className="w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {referencias.map((r) => (
                      <tr key={r.id}>
                        <td>{r.base}</td>
                        <td className="text-xs">{r.codigo}</td>
                        <td>{r.descricao}</td>
                        <td>{r.unidade ?? '—'}</td>
                        <td className="num">
                          <Moeda valor={r.preco_unitario} />
                        </td>
                        <td>
                          <form action={importarComposicao}>
                            <input type="hidden" name="preco_id" value={r.id} />
                            <input type="hidden" name="orcamento_id" value={orcamentoId} />
                            <input type="hidden" name="obra_id" value={obraId} />
                            <button className="text-rv-700 underline text-xs" type="submit">
                              usar
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Cartao>
          )}
        </div>

        <div className="space-y-3">
          <Cartao titulo="Gerar o documento">
            <SeletorVersao href={`/obras/${obraId}/orcamentos/${orcamentoId}/documento`} />
            <p className="mt-2 text-[11px] text-slate-500">
              Custo, margem e BDI nunca saem na versão do cliente, seja qual for a combinação.
            </p>
          </Cartao>

          <Cartao titulo={emEdicao ? 'Editar item' : 'Novo item'}>
            <FormularioItem
              obraId={obraId}
              orcamentoId={orcamentoId}
              item={emEdicao}
              proximaOrdem={itens.length + 1}
              completo={completo}
            />
            {emEdicao && (
              <Link
                href={`/obras/${obraId}/orcamentos/${orcamentoId}`}
                className="botao botao-neutro mt-2 w-full"
              >
                Cancelar edição
              </Link>
            )}
          </Cartao>

          <Cartao titulo="Orçamento">
            <FormularioCabecalho
              obraId={obraId}
              orcamento={orcamento}
              textosPadrao={{
                prazo: texto(parametros, 'texto_prazo_execucao'),
                garantia: texto(parametros, 'texto_garantia'),
                nao_incluso: texto(parametros, 'texto_nao_incluso'),
              }}
            />
          </Cartao>
        </div>
      </div>
    </>
  )
}
