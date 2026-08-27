import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarProjetoSolar } from '@/lib/dados/solar'
import { calcularEconomia } from '@/lib/domain/solar'
import { TituloPagina, Cartao, Indicador, Etiqueta, Moeda, Vazio } from '@/components/ui'
import { formatarMoeda, formatarNumero, formatarPercentual } from '@/lib/format'
import { FormularioProjeto } from '../formulario'
import { congelarCotacao } from '../acoes'

export default async function DetalheProjetoSolar({
  params,
}: {
  params: Promise<{ projetoId: string }>
}) {
  const { projetoId } = await params
  await exigirAdmin()

  const dados = await carregarProjetoSolar(projetoId)
  if (!dados) notFound()

  const { projeto, dimensionamento: d, cotacao, parametros, percentual_fio_b, tarifa_fio_b, anexo_url } = dados

  const economia = calcularEconomia({
    dimensionamento: d,
    tarifa: projeto.tarifa,
    tarifa_fio_b,
    percentual_fio_b,
    investimento_total: cotacao.preco_venda,
  })

  return (
    <>
      <TituloPagina
        titulo={projeto.cliente_nome}
        subtitulo={
          <>
            {projeto.concessionaria ?? 'Equatorial Piauí'}
            {projeto.uc && ` · UC ${projeto.uc}`} · ligação {projeto.tipo_ligacao}
            <Etiqueta tom="neutra">{projeto.status}</Etiqueta>
          </>
        }
        acoes={
          <>
            <Link href={`/solar/${projetoId}/proposta`} className="botao botao-primario">
              Proposta (PDF)
            </Link>
            <Link href={`/api/solar/${projetoId}/planilha`} className="botao botao-neutro">
              Planilha ao cliente
            </Link>
            <Link href={`/api/solar/${projetoId}/planilha?interna=1`} className="botao botao-neutro">
              Planilha interna
            </Link>
            <Link href="/solar" className="botao botao-neutro">
              Projetos
            </Link>
          </>
        }
      />

      {d.aviso ? (
        <p className="mb-3 rounded border border-alerta-700/40 bg-alerta-100 text-alerta-700 px-3 py-2 text-sm font-medium">
          {d.aviso}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-4 mb-3">
          <Indicador
            rotulo="Sistema"
            valor={`${formatarNumero(d.potencia_instalada_kwp, 2)} kWp`}
            detalhe={`${d.qtd_modulos} módulos · ${formatarNumero(d.area_necessaria_m2, 1)} m²`}
          />
          <Indicador
            rotulo="Geração estimada"
            valor={`${formatarNumero(d.geracao_mensal_estimada, 0)} kWh/mês`}
            detalhe={`cobre ${formatarPercentual(d.cobertura_consumo, 0)} do consumo`}
          />
          <Indicador
            rotulo="Economia líquida"
            valor={`${formatarMoeda(economia.economia_liquida_mes)}/mês`}
            tom="ok"
            detalhe={`Fio B em ${formatarPercentual(percentual_fio_b, 0)}`}
          />
          <Indicador
            rotulo="Investimento"
            valor={formatarMoeda(cotacao.preco_venda)}
            detalhe={
              economia.payback_anos
                ? `payback em ${formatarNumero(economia.payback_anos, 1)} anos`
                : undefined
            }
          />
        </div>
      )}

      {cotacao.alertas.length > 0 && (
        <div className="mb-3 rounded border border-alerta-700/40 bg-alerta-100 px-3 py-2">
          <p className="text-sm font-bold text-alerta-700">Antes de enviar a proposta:</p>
          <ul className="mt-1 text-xs text-alerta-700 list-disc pl-5">
            {cotacao.alertas.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
          <Link href="/cadastros/cotacoes" className="botao botao-neutro mt-2">
            Atualizar a base de preços
          </Link>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <Cartao titulo="Cotação — apuração interna">
            {cotacao.itens.length === 0 ? (
              <Vazio>Sem itens. Verifique a base de preços.</Vazio>
            ) : (
              <div className="overflow-x-auto">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Un.</th>
                      <th className="num">Qtd.</th>
                      <th className="num">Custo unit.</th>
                      <th className="num">Custo total</th>
                      <th>Fornecedor</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="secao">
                      <td colSpan={6}>Equipamentos</td>
                    </tr>
                    {cotacao.itens
                      .filter((i) => i.categoria !== 'servico' && i.categoria !== 'frete')
                      .map((i, k) => (
                        <LinhaCotacao key={k} item={i} />
                      ))}
                    <tr className="subtotal">
                      <td colSpan={4}>Subtotal de equipamentos</td>
                      <td className="num">{formatarMoeda(cotacao.custo_equipamentos)}</td>
                      <td></td>
                    </tr>
                    <tr className="secao">
                      <td colSpan={6}>Serviços</td>
                    </tr>
                    {cotacao.itens
                      .filter((i) => i.categoria === 'servico')
                      .map((i, k) => (
                        <LinhaCotacao key={`s${k}`} item={i} />
                      ))}
                    {cotacao.custo_frete > 0 && (
                      <tr>
                        <td>Frete</td>
                        <td>vb</td>
                        <td className="num">1</td>
                        <td className="num">{formatarMoeda(cotacao.custo_frete)}</td>
                        <td className="num">{formatarMoeda(cotacao.custo_frete)}</td>
                        <td></td>
                      </tr>
                    )}
                    <tr className="subtotal">
                      <td colSpan={4}>Custo total</td>
                      <td className="num">{formatarMoeda(cotacao.custo_total)}</td>
                      <td></td>
                    </tr>
                    <tr className="subtotal">
                      <td colSpan={4}>
                        Margem ({formatarPercentual(parametros.margem, 0)})
                      </td>
                      <td className="num">{formatarMoeda(cotacao.margem_valor)}</td>
                      <td></td>
                    </tr>
                    <tr className="total">
                      <td colSpan={4}>Preço de venda</td>
                      <td className="num">{formatarMoeda(cotacao.preco_venda)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              Esta tela é interna. Na proposta ao cliente, os equipamentos saem listados sem preço
              item a item — apenas o valor global.
            </p>
          </Cartao>

          <Cartao titulo="Dimensionamento">
            <table className="tabela">
              <tbody>
                <L r="Consumo médio mensal" v={`${formatarNumero(d.consumo_medio_mensal, 0)} kWh`} />
                <L r="Custo de disponibilidade" v={`${d.custo_disponibilidade} kWh`} />
                <L r="Energia a compensar" v={`${formatarNumero(d.energia_a_compensar, 0)} kWh/mês`} />
                <L r="Potência instalada" v={`${formatarNumero(d.potencia_instalada_kwp, 2)} kWp`} />
                <L r="Inversor sugerido" v={`${formatarNumero(d.potencia_inversor_kw, 2)} kW`} />
                <L r="Área necessária" v={`${formatarNumero(d.area_necessaria_m2, 2)} m²`} />
                <L r="Geração mensal estimada" v={`${formatarNumero(d.geracao_mensal_estimada, 0)} kWh`} />
              </tbody>
            </table>
          </Cartao>
        </div>

        <div className="space-y-3">
          <Cartao titulo="Congelar a cotação">
            <p className="text-sm text-slate-600 mb-2">
              Grava no projeto o sistema e os valores de hoje. A proposta já enviada não muda
              sozinha quando o preço do fornecedor mudar.
            </p>
            <form action={congelarCotacao}>
              <input type="hidden" name="id" value={projetoId} />
              <button className="botao botao-primario w-full" type="submit">
                Congelar valores
              </button>
            </form>
            {projeto.preco_venda !== null && (
              <p className="mt-2 text-xs text-ok-700">
                Congelado em {formatarMoeda(projeto.preco_venda)}
                {projeto.qtd_modulos ? ` · ${projeto.qtd_modulos} módulos` : ''}
              </p>
            )}
          </Cartao>

          {anexo_url && (
            <Cartao titulo="Conta de energia">
              <a href={anexo_url} target="_blank" rel="noreferrer" className="botao botao-neutro w-full">
                Abrir anexo
              </a>
            </Cartao>
          )}

          <Cartao titulo="Dados do projeto">
            <FormularioProjeto projeto={projeto} clienteId={projeto.cliente_id} />
          </Cartao>
        </div>
      </div>
    </>
  )
}

function LinhaCotacao({ item }: { item: import('@/lib/domain/proposta-solar').ItemProposta }) {
  return (
    <tr>
      <td>
        {item.descricao}
        {item.situacao && item.situacao !== 'vigente' && (
          <span className="ml-2 etiqueta etiqueta-erro">
            {item.situacao === 'vencido' ? 'preço vencido' : 'preço antigo'}
          </span>
        )}
      </td>
      <td>{item.unidade}</td>
      <td className="num">{formatarNumero(item.quantidade, item.quantidade % 1 === 0 ? 0 : 2)}</td>
      <td className="num">
        <Moeda valor={item.custo_unitario} />
      </td>
      <td className="num">
        <Moeda valor={item.custo_total} />
      </td>
      <td className="text-[10px]">{item.fornecedor ?? '—'}</td>
    </tr>
  )
}

function L({ r, v }: { r: string; v: string }) {
  return (
    <tr>
      <td>{r}</td>
      <td className="num">{v}</td>
    </tr>
  )
}
