import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { carregarOrcamento } from '@/lib/dados/orcamento'
import { carregarParametros, dadosEmpresa } from '@/lib/parametros'
import { colunasDoRelatorio, versaoDaQuery, versaoParaCliente } from '@/lib/domain/versoes-exibicao'
import { Documento, BlocoDados, BarraImpressao } from '@/components/documento'
import { BotaoImprimir } from '@/components/botao-imprimir'
import { formatarData, formatarMoeda, formatarNumero, formatarPercentual } from '@/lib/format'
import { referenciasUsadas } from '@/lib/domain/orcamento'

/**
 * Documento do orcamento (spec 4.13), com as versoes de exibicao do item 4.14.
 *
 * Regra absoluta: custo de material, custo de mao de obra, margem e BDI nunca
 * aparecem na versao do cliente. Aqui a versao passa por versaoParaCliente(),
 * que desliga esses blocos de qualquer jeito, e o BDI so vira linha quando o
 * modo escolhido no orcamento e 'visivel' — que e a versao interna.
 */
export default async function DocumentoOrcamento({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string; orcamentoId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { obraId, orcamentoId } = await params
  const query = await searchParams
  await exigirAdmin()

  const versao = versaoParaCliente(versaoDaQuery(query))
  const [obra, dados, parametros] = await Promise.all([
    carregarObra(obraId),
    carregarOrcamento(orcamentoId),
    carregarParametros(),
  ])
  if (!obra || !dados) notFound()

  const { orcamento, calculo, pendencias } = dados
  const empresa = dadosEmpresa(parametros)
  const cliente = obra.pagador ?? obra.cliente
  const col = colunasDoRelatorio(versao)
  const semValor = versao.versao_pedreiro
  const completo = orcamento.tipo === 'completo'
  const c = orcamento.condicoes

  const cabecalho = [
    { rotulo: 'Cliente', valor: cliente?.nome ?? '—' },
    { rotulo: 'Obra', valor: obra.nome },
    ...(versao.mostrar_cnpj_cliente && cliente?.documento
      ? [{ rotulo: 'CPF/CNPJ', valor: cliente.documento }]
      : []),
    { rotulo: 'Local', valor: obra.endereco ?? '—' },
    { rotulo: 'Data', valor: formatarData(orcamento.data) },
    ...(orcamento.validade ? [{ rotulo: 'Validade', valor: formatarData(orcamento.validade) }] : []),
    ...(versao.mostrar_numero_documento && orcamento.numero
      ? [{ rotulo: 'Orçamento nº', valor: orcamento.numero }]
      : []),
  ]

  // Fases so aparecem no orcamento completo; no rapido a lista e corrida.
  const linhas = completo && calculo.fases.length > 0 ? calculo.fases : null

  return (
    <>
      <BarraImpressao>
        <Link href={`/obras/${obraId}/orcamentos/${orcamentoId}`} className="botao botao-neutro">
          Voltar
        </Link>
        <BotaoImprimir />
        <Link
          href={`/api/obras/${obraId}/orcamentos/${orcamentoId}/planilha`}
          className="botao botao-neutro"
        >
          Planilha (xlsx)
        </Link>
      </BarraImpressao>

      <Documento
        empresa={empresa}
        titulo={orcamento.titulo ?? 'Orçamento'}
        subtitulo={completo ? 'Orçamento executivo' : 'Proposta de serviços'}
        geradoEm={new Date()}
        cabecalho={<BlocoDados itens={cabecalho} />}
      >
        <table className="tabela">
          <thead>
            <tr>
              {completo && <th className="w-14">Item</th>}
              <th>Descrição</th>
              {col.quantidade && <th className="num">Qtd.</th>}
              {col.quantidade && <th>Un.</th>}
              {col.preco_unitario && <th className="num">Preço unit.</th>}
              {col.valor && <th className="num">Total</th>}
            </tr>
          </thead>
          <tbody>
            {linhas
              ? linhas.map((f) => (
                  <FaseBloco
                    key={f.fase}
                    fase={f}
                    completo={completo}
                    col={col}
                    semValor={semValor}
                    agruparValorUnico={versao.agrupar_valor_unico}
                  />
                ))
              : calculo.itens.map((i) => (
                  <LinhaItem key={i.id} item={i} completo={completo} col={col} semValor={semValor} />
                ))}

            {col.valor && (
              <>
                {orcamento.modo_bdi === 'visivel' && calculo.totais.valor_bdi > 0 && (
                  <>
                    <tr className="subtotal">
                      <td colSpan={numeroDeColunas(col, completo) - 1}>Subtotal</td>
                      <td className="num">{formatarMoeda(calculo.totais.subtotal)}</td>
                    </tr>
                    <tr className="subtotal">
                      <td colSpan={numeroDeColunas(col, completo) - 1}>
                        BDI ({formatarPercentual(orcamento.bdi, 0)})
                      </td>
                      <td className="num">{formatarMoeda(calculo.totais.valor_bdi)}</td>
                    </tr>
                  </>
                )}
                <tr className="total">
                  <td colSpan={numeroDeColunas(col, completo) - 1}>Total geral</td>
                  <td className="num">{formatarMoeda(calculo.totais.total)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        {calculo.totais.itens_sem_valor > 0 && (
          <p className="mt-2 text-[10px] text-slate-600">
            Os itens marcados como <strong>a cotar separadamente</strong> estão descritos acima e
            não integram o valor total desta proposta.
          </p>
        )}

        {pendencias.length > 0 && (
          <div className="mt-3">
            <h2 className="text-[11px] font-bold uppercase text-rv-900 mb-1">Itens a definir</h2>
            <ul className="text-[10px] list-disc pl-4 space-y-0.5">
              {pendencias.map((p) => (
                <li key={p.id}>
                  {p.descricao}
                  {p.observacao ? ` — ${p.observacao}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!semValor && (
          <div className="mt-4 grid grid-cols-2 gap-3 text-[10px]">
            {versao.mostrar_prazo_execucao && c.prazo && (
              <div>
                <strong className="block uppercase text-rv-900">Prazo de execução</strong>
                {c.prazo}
              </div>
            )}
            {c.forma_pagamento && (
              <div>
                <strong className="block uppercase text-rv-900">Forma de pagamento</strong>
                {c.forma_pagamento}
              </div>
            )}
            {c.garantia && (
              <div>
                <strong className="block uppercase text-rv-900">Garantia</strong>
                {c.garantia}
              </div>
            )}
            {c.nao_incluso && (
              <div>
                <strong className="block uppercase text-rv-900">Não está incluso</strong>
                {c.nao_incluso}
              </div>
            )}
          </div>
        )}

        {versao.destacar_composicao_custo && (
          <p className="mt-3 rounded border border-rv-600 bg-rv-50 px-2 py-1.5 text-[10px]">
            A composição do custo desta obra concentra-se em material e locação de equipamentos, que
            respondem pela maior parte do valor. A mão de obra é a menor parcela do total.
          </p>
        )}
      </Documento>

      {orcamento.memorial && (
        <div className="quebra-pagina">
          <Documento
            empresa={empresa}
            titulo="Memorial descritivo"
            subtitulo={orcamento.titulo ?? undefined}
            cabecalho={
              <BlocoDados
                itens={[
                  { rotulo: 'Cliente', valor: cliente?.nome ?? '—' },
                  { rotulo: 'Obra', valor: obra.nome },
                ]}
              />
            }
          >
            <div className="whitespace-pre-wrap text-[11px] leading-relaxed">
              {orcamento.memorial}
            </div>
          </Documento>
        </div>
      )}

      {/* Pesquisa de precos: a origem de cada composicao usada */}
      {calculo.itens.some((i) => i.base_referencia !== 'proprio') && (
        <div className="quebra-pagina">
          <Documento
            empresa={empresa}
            titulo="Pesquisa de preços"
            subtitulo="Composições de referência utilizadas"
            cabecalho={
              <BlocoDados
                itens={[
                  { rotulo: 'Obra', valor: obra.nome },
                  { rotulo: 'Orçamento', valor: orcamento.titulo ?? '—' },
                ]}
              />
            }
          >
            {/* Sem a data-base e a versao, "SINAPI 88489" nao permite conferir
                nada: o mesmo codigo muda de preco todo mes, e muda de novo
                entre a versao desonerada e a nao desonerada. */}
            {referenciasUsadas(calculo.itens).length > 0 && (
              <p className="mb-2 text-[11px] text-slate-700">
                <strong>Tabelas utilizadas:</strong> {referenciasUsadas(calculo.itens).join(' · ')}
              </p>
            )}
            <table className="tabela">
              <thead>
                <tr>
                  <th>Base</th>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th>Un.</th>
                </tr>
              </thead>
              <tbody>
                {calculo.itens
                  .filter((i) => i.base_referencia !== 'proprio')
                  .map((i) => (
                    <tr key={i.id}>
                      <td>{i.base_referencia}</td>
                      <td>{i.codigo_referencia ?? '—'}</td>
                      <td>{i.descricao}</td>
                      <td>{i.unidade ?? '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <p className="mt-2 text-[10px] text-slate-600">
              Os demais itens têm composição própria da {empresa.nome}.
            </p>
          </Documento>
        </div>
      )}
    </>
  )
}

type Colunas = ReturnType<typeof colunasDoRelatorio>

function numeroDeColunas(col: Colunas, completo: boolean): number {
  // descricao + (qtd + unidade) + preco unitario + total, mais a coluna de item
  return (
    (completo ? 1 : 0) + 1 + (col.quantidade ? 2 : 0) + (col.preco_unitario ? 1 : 0) + (col.valor ? 1 : 0)
  )
}

function LinhaItem({
  item,
  completo,
  col,
  semValor,
}: {
  item: import('@/lib/domain/orcamento').ItemCalculado
  completo: boolean
  col: Colunas
  semValor: boolean
}) {
  return (
    <tr>
      {completo && <td className="text-[10px]">{item.fase ?? ''}</td>}
      <td>
        {item.descricao}
        {item.base_referencia !== 'proprio' && item.codigo_referencia && (
          <span className="text-[9px] text-slate-500">
            {' '}
            ({item.base_referencia} {item.codigo_referencia})
          </span>
        )}
      </td>
      {col.quantidade && (
        <td className="num">{item.quantidade === null ? '—' : formatarNumero(item.quantidade)}</td>
      )}
      {col.quantidade && <td>{item.unidade ?? '—'}</td>}
      {col.preco_unitario && (
        <td className="num">
          {item.terceirizado_sem_valor ? '—' : formatarMoeda(item.preco_exibido_unitario)}
        </td>
      )}
      {col.valor && (
        <td className="num">
          {item.terceirizado_sem_valor ? (
            <span className="text-[10px]">a cotar</span>
          ) : (
            formatarMoeda(item.total)
          )}
        </td>
      )}
      {semValor && null}
    </tr>
  )
}

function FaseBloco({
  fase,
  completo,
  col,
  semValor,
  agruparValorUnico,
}: {
  fase: import('@/lib/domain/orcamento').FaseOrcamento
  completo: boolean
  col: Colunas
  semValor: boolean
  agruparValorUnico: boolean
}) {
  const colunas = numeroDeColunas(col, completo)

  if (agruparValorUnico && col.valor) {
    return (
      <tr>
        <td colSpan={colunas - 1}>
          <strong>{fase.fase}</strong> {fase.descricao}
        </td>
        <td className="num">{formatarMoeda(fase.subtotal)}</td>
      </tr>
    )
  }

  return (
    <>
      <tr className="secao">
        <td colSpan={colunas}>
          {fase.fase} — {fase.descricao}
        </td>
      </tr>
      {fase.itens.map((i) => (
        <LinhaItem key={i.id} item={i} completo={completo} col={col} semValor={semValor} />
      ))}
      {col.valor && fase.nivel === 1 && (
        <tr className="subtotal">
          <td colSpan={colunas - 1}>Subtotal da fase {fase.fase}</td>
          <td className="num">{formatarMoeda(fase.subtotal)}</td>
        </tr>
      )}
    </>
  )
}
