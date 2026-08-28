import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { carregarMedicoes, carregarTerceiros } from '@/lib/dados/medicoes'
import { criarClienteServidor } from '@/lib/supabase/server'
import { ROTULO_UNIDADE } from '@/lib/domain/medicoes'
import { TituloPagina, Cartao, Indicador, Vazio, Etiqueta, Moeda } from '@/components/ui'
import { formatarData, formatarMoeda, formatarNumero, formatarPercentual } from '@/lib/format'
import { FormularioServico, FormularioMedicao, FormularioTerceiro } from './formulario'
import { arquivarServico, estornarMedicao } from './acoes'

function unidade(u: string): string {
  return ROTULO_UNIDADE[u as keyof typeof ROTULO_UNIDADE] ?? u
}

export default async function PaginaMedicoes({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>
  searchParams: Promise<{ editar?: string }>
}) {
  const { obraId } = await params
  const { editar } = await searchParams
  await exigirAdmin()

  const obra = await carregarObra(obraId)
  if (!obra) notFound()

  const supabase = await criarClienteServidor()
  const [{ servicos, medicoes, totais }, terceiros, { data: locaisData }, { data: cadastroTerceiros }] =
    await Promise.all([
      carregarMedicoes(obraId),
      carregarTerceiros(obraId),
      supabase.from('locais_obra').select('id, nome').eq('obra_id', obraId).is('excluido_em', null).order('nome'),
      supabase.from('terceiros').select('id, nome, atividade').is('excluido_em', null).order('nome'),
    ])

  const locais = (locaisData ?? []) as { id: string; nome: string }[]
  const nomeLocal = new Map(locais.map((l) => [l.id, l.nome]))
  const emEdicao = editar ? servicos.find((s) => s.id === editar) ?? null : null

  return (
    <>
      <TituloPagina
        titulo="Medições e terceiros"
        subtitulo={`${obra.nome} — serviço cobrado por produção, não por diária`}
        acoes={
          <Link href={`/obras/${obraId}`} className="botao botao-neutro">
            Voltar à obra
          </Link>
        }
      />

      <div className="grid gap-2 sm:grid-cols-4 mb-3">
        <Indicador rotulo="Executado" valor={formatarMoeda(totais.valor_executado)} tom="ok" />
        <Indicador rotulo="Contratado" valor={formatarMoeda(totais.valor_contratado)} />
        <Indicador
          rotulo="Custo das medições"
          valor={formatarMoeda(totais.custo_executado)}
          detalhe="interno"
        />
        <Indicador
          rotulo="Terceiros a pagar"
          valor={formatarMoeda(terceiros.totais.saldo)}
          tom={terceiros.totais.saldo > 0 ? 'alerta' : 'ok'}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <Cartao titulo={`Serviços por medição (${servicos.length})`}>
            {servicos.length === 0 ? (
              <Vazio>
                Nenhum serviço cadastrado. Ex.: forro a R$ 90,00/m², sanca a R$ 90,00/m linear.
              </Vazio>
            ) : (
              <div className="rolagem">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Serviço</th>
                      <th>Un.</th>
                      <th className="num">Contratado</th>
                      <th className="num">Executado</th>
                      <th className="num">Preço unit.</th>
                      <th className="num">Valor executado</th>
                      <th className="num">Margem</th>
                      <th className="w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {servicos.map((s) => (
                      <tr key={s.id}>
                        <td className="font-semibold">{s.descricao}</td>
                        <td>{unidade(String(s.unidade))}</td>
                        <td className="num">
                          {s.quantidade_contratada === null
                            ? '—'
                            : formatarNumero(s.quantidade_contratada)}
                        </td>
                        <td className="num">
                          {formatarNumero(s.quantidade_executada)}
                          {s.percentual_executado !== null && (
                            <div className="text-[10px] text-slate-500">
                              {formatarPercentual(s.percentual_executado, 0)}
                            </div>
                          )}
                        </td>
                        <td className="num">
                          <Moeda valor={s.preco_venda_unitario} />
                        </td>
                        <td className="num font-semibold">
                          <Moeda valor={s.valor_executado} />
                        </td>
                        <td className="num">
                          {s.custo_unitario === null ? (
                            '—'
                          ) : (
                            <>
                              <Moeda valor={s.margem} />
                              <div className="text-[10px] text-slate-500">
                                {formatarPercentual(s.margem_percentual, 0)}
                              </div>
                            </>
                          )}
                        </td>
                        <td className="whitespace-nowrap text-xs">
                          <Link
                            href={`/obras/${obraId}/medicoes?editar=${s.id}`}
                            className="acao acao-neutra"
                          >
                            editar
                          </Link>
                          <form action={arquivarServico} className="inline">
                            <input type="hidden" name="id" value={s.id} />
                            <input type="hidden" name="obra_id" value={obraId} />
                            <button className="acao acao-perigo" type="submit">
                              remover
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                    <tr className="total">
                      <td colSpan={5}>Total executado</td>
                      <td className="num">{formatarMoeda(totais.valor_executado)}</td>
                      <td className="num">{formatarMoeda(totais.margem)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              Custo unitário e margem são internos: no documento do cliente sai apenas o preço de
              venda.
            </p>
          </Cartao>

          <Cartao titulo={`Medições lançadas (${medicoes.length})`}>
            {medicoes.length === 0 ? (
              <Vazio>Nenhuma medição lançada.</Vazio>
            ) : (
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Serviço</th>
                    <th>Local</th>
                    <th className="num">Quantidade</th>
                    <th className="num">Valor</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {medicoes.map((m) => (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap">{formatarData(m.data)}</td>
                      <td>{m.servico_descricao}</td>
                      <td>{m.local_id ? nomeLocal.get(m.local_id) ?? '—' : 'obra inteira'}</td>
                      <td className="num">
                        {formatarNumero(m.quantidade)} {unidade(m.servico_unidade)}
                      </td>
                      <td className="num">
                        <Moeda valor={m.valor} />
                      </td>
                      <td>
                        <form action={estornarMedicao}>
                          <input type="hidden" name="id" value={m.id} />
                          <input type="hidden" name="obra_id" value={obraId} />
                          <button className="acao acao-perigo" type="submit">
                            estornar
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Cartao>

          <Cartao titulo={`Serviços de terceiros (${terceiros.servicos.length})`}>
            {terceiros.servicos.length === 0 ? (
              <Vazio>Nenhum serviço de terceiro lançado nesta obra.</Vazio>
            ) : (
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Terceiro</th>
                    <th>Serviço</th>
                    <th className="num">Combinado</th>
                    <th className="num">Pago</th>
                    <th className="num">Saldo</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {terceiros.servicos.map((t) => (
                    <tr key={t.id}>
                      <td className="font-semibold">
                        {t.terceiro_nome}
                        {t.terceiro_atividade && (
                          <div className="text-[10px] text-slate-500">{t.terceiro_atividade}</div>
                        )}
                      </td>
                      <td>{t.descricao ?? '—'}</td>
                      <td className="num">
                        <Moeda valor={t.valor_combinado} />
                      </td>
                      <td className="num">
                        <Moeda valor={t.valor_pago} />
                      </td>
                      <td className="num">
                        <Moeda valor={t.saldo} />
                      </td>
                      <td>
                        {t.quitado ? (
                          <Etiqueta tom="ok">quitado</Etiqueta>
                        ) : (
                          <Etiqueta tom="alerta">em aberto</Etiqueta>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td colSpan={2}>Total</td>
                    <td className="num">{formatarMoeda(terceiros.totais.combinado)}</td>
                    <td className="num">{formatarMoeda(terceiros.totais.pago)}</td>
                    <td className="num">{formatarMoeda(terceiros.totais.saldo)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            )}
          </Cartao>
        </div>

        <div className="space-y-3">
          <Cartao titulo={emEdicao ? 'Editar serviço' : 'Novo serviço por medição'}>
            <FormularioServico obraId={obraId} servico={emEdicao} />
            {emEdicao && (
              <Link href={`/obras/${obraId}/medicoes`} className="botao botao-neutro mt-2 w-full">
                Cancelar edição
              </Link>
            )}
          </Cartao>

          {servicos.length > 0 && (
            <Cartao titulo="Lançar medição executada">
              <FormularioMedicao
                obraId={obraId}
                servicos={servicos.map((s) => ({
                  id: s.id,
                  descricao: s.descricao,
                  unidade: String(s.unidade),
                  saldo: s.saldo_a_executar,
                }))}
                locais={locais}
              />
            </Cartao>
          )}

          <Cartao titulo="Serviço de terceiro">
            {(cadastroTerceiros ?? []).length === 0 ? (
              <p className="text-sm text-slate-600">
                Cadastre um terceiro primeiro em{' '}
                <Link href="/cadastros/terceiros" className="acao acao-neutra">
                  Cadastros → Terceiros
                </Link>
                .
              </p>
            ) : (
              <FormularioTerceiro
                obraId={obraId}
                terceiros={(cadastroTerceiros ?? []) as { id: string; nome: string; atividade: string | null }[]}
              />
            )}
          </Cartao>
        </div>
      </div>
    </>
  )
}
