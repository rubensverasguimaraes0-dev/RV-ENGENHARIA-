import Link from 'next/link'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { criarClienteServidor } from '@/lib/supabase/server'
import { carregarBaseDePrecos, listarCotacoes } from '@/lib/dados/cotacoes'
import { situacaoDoPreco } from '@/lib/domain/cotacoes'
import { TituloPagina, Cartao, Vazio, Etiqueta, Moeda, Indicador } from '@/components/ui'
import { formatarData, formatarMoeda, hojeISO } from '@/lib/format'
import { FormularioNovaCotacao } from './formulario'
import { alternarBase, arquivarCotacao } from './acoes'

export default async function PaginaCotacoes({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>
}) {
  await exigirAdmin()
  const { categoria } = await searchParams
  const supabase = await criarClienteServidor()

  const [cotacoes, base, { data: fornecedoresData }] = await Promise.all([
    listarCotacoes(),
    carregarBaseDePrecos(categoria),
    supabase.from('fornecedores').select('id, nome').is('excluido_em', null).order('nome'),
  ])

  const hoje = hojeISO()
  const categorias = [...new Set(base.todos.map((i) => i.categoria).filter(Boolean))] as string[]
  const vencidos = base.grupos.filter((g) => g.escolhido.situacao !== 'vigente').length

  return (
    <>
      <TituloPagina
        titulo="Base de preços"
        subtitulo="Cotações dos fornecedores, compartilhadas entre obras civis e energia solar"
      />

      <div className="grid gap-2 sm:grid-cols-3 mb-3">
        <Indicador rotulo="Cotações registradas" valor={String(cotacoes.length)} />
        <Indicador rotulo="Produtos na base" valor={String(base.grupos.length)} />
        <Indicador
          rotulo="Com preço vencido ou antigo"
          valor={String(vencidos)}
          tom={vencidos > 0 ? 'erro' : 'ok'}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <Cartao titulo="Menor preço vigente por produto">
            {categorias.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                <Link
                  href="/cadastros/cotacoes"
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    !categoria ? 'bg-rv-800 text-white' : 'bg-rv-50 text-rv-800'
                  }`}
                >
                  todas
                </Link>
                {categorias.map((c) => (
                  <Link
                    key={c}
                    href={`/cadastros/cotacoes?categoria=${encodeURIComponent(c)}`}
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      categoria === c ? 'bg-rv-800 text-white' : 'bg-rv-50 text-rv-800'
                    }`}
                  >
                    {c}
                  </Link>
                ))}
              </div>
            )}

            {base.grupos.length === 0 ? (
              <Vazio>
                Nenhum item cotado ainda. Registre uma cotação ao lado e lance os itens.
              </Vazio>
            ) : (
              <div className="overflow-x-auto">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Fornecedor</th>
                      <th>Cotado em</th>
                      <th className="num">Menor preço</th>
                      <th>Situação</th>
                      <th className="num">Alternativas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {base.grupos.map((g) => (
                      <tr key={g.chave}>
                        <td>
                          <span className="font-semibold">{g.chave}</span>
                          {g.escolhido.estimado && (
                            <span className="ml-2 etiqueta etiqueta-alerta">estimado</span>
                          )}
                          {g.escolhido.substituido && (
                            <span className="ml-2 etiqueta etiqueta-alerta">substituído</span>
                          )}
                        </td>
                        <td>{g.escolhido.cotacao.fornecedor_nome}</td>
                        <td className="whitespace-nowrap">
                          {formatarData(g.escolhido.cotacao.data)}
                          <div className="text-[10px] text-slate-500">
                            {g.escolhido.dias_desde_cotacao} dia(s)
                          </div>
                        </td>
                        <td className="num font-semibold">
                          <Moeda valor={g.escolhido.preco_unitario} />
                        </td>
                        <td>
                          {g.escolhido.situacao === 'vigente' && <Etiqueta tom="ok">vigente</Etiqueta>}
                          {g.escolhido.situacao === 'antigo' && (
                            <Etiqueta tom="alerta">mais de 30 dias</Etiqueta>
                          )}
                          {g.escolhido.situacao === 'vencido' && (
                            <Etiqueta tom="erro">vencido</Etiqueta>
                          )}
                        </td>
                        <td className="num text-xs">
                          {g.alternativas.length === 0
                            ? '—'
                            : g.alternativas
                                .slice(0, 2)
                                .map(
                                  (a) =>
                                    `${a.cotacao.fornecedor_nome}: ${formatarMoeda(a.preco_unitario)}`,
                                )
                                .join(' · ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] text-slate-500">
                  Preço vencido nunca ganha de um vigente, por mais barato que seja; só entra quando
                  não há alternativa, e sai sinalizado.
                </p>
              </div>
            )}
          </Cartao>

          <Cartao titulo={`Cotações recebidas (${cotacoes.length})`}>
            {cotacoes.length === 0 ? (
              <Vazio>Nenhuma cotação registrada.</Vazio>
            ) : (
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Fornecedor</th>
                    <th>Documento</th>
                    <th>Data</th>
                    <th>Validade</th>
                    <th className="num">Total</th>
                    <th className="w-28"></th>
                  </tr>
                </thead>
                <tbody>
                  {cotacoes.map((c) => {
                    const s = situacaoDoPreco(c, hoje)
                    return (
                      <tr key={c.id}>
                        <td>
                          <Link
                            href={`/cadastros/cotacoes/${c.id}`}
                            className="font-semibold text-rv-700 underline"
                          >
                            {c.fornecedor_nome}
                          </Link>
                          {c.base && <span className="ml-2 etiqueta etiqueta-ok">base</span>}
                          {c.condicao_pagamento && (
                            <div className="text-[10px] text-slate-500">{c.condicao_pagamento}</div>
                          )}
                        </td>
                        <td className="text-xs">{c.numero_documento ?? '—'}</td>
                        <td className="whitespace-nowrap">{formatarData(c.data)}</td>
                        <td className="whitespace-nowrap">
                          {c.validade ? formatarData(c.validade) : '—'}
                          {s !== 'vigente' && (
                            <Etiqueta tom={s === 'vencido' ? 'erro' : 'alerta'}>
                              {s === 'vencido' ? 'vencida' : 'antiga'}
                            </Etiqueta>
                          )}
                        </td>
                        <td className="num">
                          <Moeda valor={c.total} />
                        </td>
                        <td className="whitespace-nowrap text-xs">
                          <form action={alternarBase} className="inline">
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="base" value={String(c.base)} />
                            <button className="text-rv-700 underline" type="submit">
                              {c.base ? 'tirar base' : 'marcar base'}
                            </button>
                          </form>
                          <form action={arquivarCotacao} className="inline">
                            <input type="hidden" name="id" value={c.id} />
                            <button className="text-erro-700 underline ml-2" type="submit">
                              arquivar
                            </button>
                          </form>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Cartao>
        </div>

        <Cartao titulo="Nova cotação">
          {(fornecedoresData ?? []).length === 0 ? (
            <p className="text-sm text-slate-600">
              Cadastre um fornecedor primeiro em{' '}
              <Link href="/cadastros/fornecedores" className="text-rv-700 underline">
                Cadastros → Fornecedores
              </Link>
              .
            </p>
          ) : (
            <FormularioNovaCotacao
              fornecedores={(fornecedoresData ?? []) as { id: string; nome: string }[]}
            />
          )}
        </Cartao>
      </div>
    </>
  )
}
