import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { carregarAlmoxarifado } from '@/lib/dados/almoxarifado'
import { calcularSaldos } from '@/lib/domain/almoxarifado'
import { TituloPagina, Cartao, Indicador, Vazio, Etiqueta, Moeda } from '@/components/ui'
import { formatarData, formatarMoeda, formatarNumero } from '@/lib/format'
import { FormularioItem, FormularioSaida } from './formulario'
import { arquivarItem, estornarSaida } from './acoes'

export default async function PaginaAlmoxarifado({
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

  const { resumo, itens, saidas } = await carregarAlmoxarifado(obraId)
  const comSaldo = calcularSaldos(itens, saidas)
  const emEdicao = editar ? itens.find((i) => i.id === editar) ?? null : null

  return (
    <>
      <TituloPagina
        titulo="Almoxarifado"
        subtitulo={`${obra.nome} — material próprio da RV guardado na obra`}
        acoes={
          <>
            <Link href={`/obras/${obraId}/almoxarifado/relatorio`} className="botao botao-primario">
              Relatório (PDF)
            </Link>
            <Link href={`/api/obras/${obraId}/almoxarifado/planilha`} className="botao botao-neutro">
              Planilha (xlsx)
            </Link>
            <Link href={`/obras/${obraId}`} className="botao botao-neutro">
              Voltar à obra
            </Link>
          </>
        }
      />

      <div className="grid gap-2 sm:grid-cols-4 mb-3">
        <Indicador rotulo="Itens em estoque" valor={String(itens.length)} />
        <Indicador
          rotulo="A cobrar do cliente"
          valor={formatarMoeda(resumo.total_cobrado)}
          tom="ok"
          detalhe="entra no fechamento"
        />
        <Indicador
          rotulo="Custo das saídas"
          valor={formatarMoeda(resumo.custo_total_saidas)}
          detalhe="interno"
        />
        <Indicador
          rotulo="Sem quantidade"
          valor={String(resumo.itens_sem_quantidade)}
          tom={resumo.itens_sem_quantidade > 0 ? 'alerta' : 'ok'}
          detalhe="a contar depois"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <Cartao titulo="Estoque por categoria">
            {resumo.grupos.length === 0 ? (
              <Vazio>Nenhum item no almoxarifado desta obra.</Vazio>
            ) : (
              <div className="overflow-x-auto">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Un.</th>
                      <th className="num">Quantidade</th>
                      <th className="num">Saídas</th>
                      <th className="num">Saldo</th>
                      <th className="num">Cobrança</th>
                      <th className="w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.grupos.map((g) => (
                      <FragmentoCategoria key={g.categoria} grupo={g} obraId={obraId} />
                    ))}
                    <tr className="total">
                      <td colSpan={5}>Total a cobrar do cliente</td>
                      <td className="num">{formatarMoeda(resumo.total_cobrado)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Cartao>

          <Cartao titulo={`Saídas (${saidas.length})`}>
            {saidas.length === 0 ? (
              <Vazio>Nenhuma saída registrada.</Vazio>
            ) : (
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Item</th>
                    <th className="num">Qtd.</th>
                    <th>Quem pegou</th>
                    <th>Onde usou</th>
                    <th>Cobrar</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {saidas.map((s) => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap">{formatarData(s.data)}</td>
                      <td>{s.item_descricao}</td>
                      <td className="num">
                        {formatarNumero(s.quantidade, s.quantidade % 1 === 0 ? 0 : 2)}{' '}
                        {s.item_unidade ?? ''}
                      </td>
                      <td>{s.quem_pegou ?? '—'}</td>
                      <td>{s.onde_usou ?? '—'}</td>
                      <td>
                        {s.cobrar_cliente ? (
                          <Etiqueta tom="ok">sim</Etiqueta>
                        ) : (
                          <Etiqueta tom="neutra">não</Etiqueta>
                        )}
                      </td>
                      <td>
                        <form action={estornarSaida}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="obra_id" value={obraId} />
                          <button className="text-erro-700 underline text-xs" type="submit">
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
        </div>

        <div className="space-y-3">
          <Cartao titulo={emEdicao ? 'Editar item' : 'Novo item'}>
            <FormularioItem obraId={obraId} item={emEdicao} />
            {emEdicao && (
              <Link href={`/obras/${obraId}/almoxarifado`} className="botao botao-neutro mt-2 w-full">
                Cancelar edição
              </Link>
            )}
          </Cartao>

          {itens.length > 0 && (
            <Cartao titulo="Registrar saída">
              <FormularioSaida
                obraId={obraId}
                itens={comSaldo.map((i) => ({
                  id: i.id,
                  descricao: i.cor_bitola ? `${i.descricao} — ${i.cor_bitola}` : i.descricao,
                  unidade: i.unidade,
                  saldo: i.saldo,
                }))}
              />
            </Cartao>
          )}
        </div>
      </div>
    </>
  )
}

function FragmentoCategoria({
  grupo,
  obraId,
}: {
  grupo: import('@/lib/domain/almoxarifado').GrupoCategoria
  obraId: string
}) {
  return (
    <>
      <tr className="secao">
        <td colSpan={7}>{grupo.categoria}</td>
      </tr>
      {grupo.itens.map((i) => (
        <tr key={i.id}>
          <td>
            {i.descricao}
            {i.cor_bitola && (
              <span className="text-[11px] text-slate-500"> · {i.cor_bitola}</span>
            )}
          </td>
          <td>{i.unidade ?? '—'}</td>
          <td className="num">
            {i.quantidade === null ? (
              <span className="etiqueta etiqueta-alerta">a contar</span>
            ) : (
              formatarNumero(i.quantidade, i.quantidade % 1 === 0 ? 0 : 2)
            )}
          </td>
          <td className="num">
            {i.total_saidas > 0 ? formatarNumero(i.total_saidas, i.total_saidas % 1 === 0 ? 0 : 2) : '—'}
          </td>
          <td className="num">
            {i.saldo === null ? '—' : formatarNumero(i.saldo, i.saldo % 1 === 0 ? 0 : 2)}
          </td>
          <td className="num">
            {i.valor_cobrado > 0 ? <Moeda valor={i.valor_cobrado} /> : '—'}
          </td>
          <td className="whitespace-nowrap text-xs">
            <Link href={`/obras/${obraId}/almoxarifado?editar=${i.id}`} className="text-rv-700 underline">
              editar
            </Link>
            <form action={arquivarItem} className="inline">
              <input type="hidden" name="id" value={i.id} />
              <input type="hidden" name="obra_id" value={obraId} />
              <button className="text-erro-700 underline ml-1" type="submit">
                remover
              </button>
            </form>
          </td>
        </tr>
      ))}
      {grupo.subgrupos.map((s) => (
        <tr key={s.cor_bitola} className="subtotal">
          <td colSpan={2}>Subtotal {s.cor_bitola} — {s.quantidade_pedacos} pedaço(s)</td>
          <td className="num">{formatarNumero(s.metragem_total)} m</td>
          <td className="num">
            {formatarNumero(s.metragem_total - s.metragem_restante)} m
          </td>
          <td className="num">{formatarNumero(s.metragem_restante)} m</td>
          <td className="num">{s.valor_cobrado > 0 ? formatarMoeda(s.valor_cobrado) : '—'}</td>
          <td></td>
        </tr>
      ))}
    </>
  )
}
