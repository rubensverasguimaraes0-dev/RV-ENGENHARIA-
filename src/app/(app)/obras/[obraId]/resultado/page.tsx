import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra, carregarPainelObra } from '@/lib/dados/obra'
import { criarClienteServidor } from '@/lib/supabase/server'
import { TituloPagina, Cartao, Indicador, Moeda, Etiqueta } from '@/components/ui'
import { formatarMoeda, formatarPercentual } from '@/lib/format'

/**
 * Resultado da obra — orcado x realizado (spec 4.15).
 * Tela interna: nunca enviada ao cliente.
 */
export default async function PaginaResultado({
  params,
}: {
  params: Promise<{ obraId: string }>
}) {
  const { obraId } = await params
  await exigirAdmin()

  const obra = await carregarObra(obraId)
  if (!obra) notFound()

  const painel = await carregarPainelObra(obra)
  const a = painel.apuracao

  const supabase = await criarClienteServidor()
  const { data: parceirosData } = await supabase
    .from('funcionarios')
    .select('id, nome')
    .eq('tipo', 'parceiro')
    .is('excluido_em', null)
    .order('nome')
  const parceiros = (parceirosData ?? []) as { id: string; nome: string }[]

  return (
    <>
      <TituloPagina
        titulo="Resultado da obra"
        subtitulo={`${obra.nome} — tela interna, nunca enviada ao cliente`}
        acoes={
          <Link href={`/obras/${obraId}`} className="botao botao-neutro">
            Voltar à obra
          </Link>
        }
      />

      <div className="grid gap-2 sm:grid-cols-4 mb-3">
        <Indicador rotulo="Receita" valor={formatarMoeda(a.receita_total)} />
        <Indicador rotulo="Custo realizado" valor={formatarMoeda(a.custo_total)} tom="alerta" />
        <Indicador
          rotulo="Resultado"
          valor={formatarMoeda(a.resultado)}
          tom={a.resultado >= 0 ? 'ok' : 'erro'}
        />
        <Indicador rotulo="Margem" valor={formatarPercentual(a.margem)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Cartao titulo="Receita — o que foi cobrado do cliente">
          <table className="tabela">
            <tbody>
              <tr className="secao">
                <td colSpan={2}>Serviço</td>
              </tr>
              <Linha rotulo="Contrato" valor={obra.valor_contrato} />
              <Linha rotulo="Medições" valor={painel.receita_medicoes} />
              <tr className="secao">
                <td colSpan={2}>Insumos repassados</td>
              </tr>
              <Linha rotulo="Notas repassadas" valor={painel.receita_notas_repassadas} />
              <Linha rotulo="Almoxarifado cobrado" valor={painel.receita_almoxarifado} />
              <tr className="total">
                <td>Receita total</td>
                <td className="num">{formatarMoeda(a.receita_total)}</td>
              </tr>
            </tbody>
          </table>
        </Cartao>

        <Cartao titulo="Custo realizado">
          <table className="tabela">
            <tbody>
              <tr className="secao">
                <td colSpan={2}>Mão de obra</td>
              </tr>
              <Linha rotulo="Diárias" valor={painel.custo_mao_obra} />
              <Linha rotulo="Quentinhas" valor={painel.custo_quentinhas} />
              <tr className="subtotal">
                <td>Subtotal de mão de obra</td>
                <td className="num">{formatarMoeda(a.custo_mao_obra)}</td>
              </tr>
              <tr className="secao">
                <td colSpan={2}>Materiais, locações e terceiros</td>
              </tr>
              <Linha rotulo="Materiais com nota" valor={painel.custo_materiais} />
              <Linha rotulo="Despesas sem nota" valor={painel.custo_despesas_sem_nota} />
              <Linha rotulo="Locações" valor={painel.custo_locacoes} />
              <Linha rotulo="Caçamba / entulho" valor={painel.custo_entulho} />
              <Linha rotulo="Terceiros" valor={painel.custo_terceiros} />
              <tr className="subtotal">
                <td>Subtotal de insumos</td>
                <td className="num">{formatarMoeda(a.custo_insumos)}</td>
              </tr>
              <tr className="total">
                <td>Custo total</td>
                <td className="num">{formatarMoeda(a.custo_total)}</td>
              </tr>
            </tbody>
          </table>
        </Cartao>

        <Cartao titulo="As duas apurações">
          <table className="tabela">
            <thead>
              <tr>
                <th>Apuração</th>
                <th className="num">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  Insumos — exclusiva da RV
                  <div className="text-[11px] text-slate-500">
                    notas repassadas e almoxarifado cobrado menos materiais, locações, entulho e
                    terceiros
                  </div>
                </td>
                <td className="num">
                  <Moeda valor={a.resultado_insumos} />
                </td>
              </tr>
              <tr>
                <td>
                  Mão de obra
                  <div className="text-[11px] text-slate-500">
                    contrato e medições menos diárias e quentinhas
                  </div>
                </td>
                <td className="num">
                  <Moeda valor={a.margem_mao_obra} />
                </td>
              </tr>
              <tr className="total">
                <td>Resultado da obra</td>
                <td className="num">{formatarMoeda(a.resultado)}</td>
              </tr>
            </tbody>
          </table>
        </Cartao>

        <Cartao titulo="Rateio com o parceiro">
          <p className="text-sm text-slate-600 mb-2">
            Base configurada nesta obra:{' '}
            <strong>
              {a.base_rateio === 'margem_mao_obra'
                ? 'margem da mão de obra'
                : 'resultado da obra'}
            </strong>{' '}
            · percentual do parceiro:{' '}
            <strong>{formatarPercentual(Number(obra.percentual_rateio_parceiro))}</strong>{' '}
            <Etiqueta tom="alerta">a confirmar</Etiqueta>
          </p>

          <table className="tabela">
            <tbody>
              <Linha rotulo="Base do rateio" valor={a.valor_base_rateio} />
              <tr>
                <td>
                  Parte do parceiro
                  {parceiros.length > 0 && (
                    <div className="text-[11px] text-slate-500">
                      {parceiros.map((p) => p.nome).join(', ')}
                    </div>
                  )}
                </td>
                <td className="num">
                  <Moeda valor={a.parte_parceiro} />
                </td>
              </tr>
              <tr className="total">
                <td>Parte da RV Engenharia</td>
                <td className="num">{formatarMoeda(a.parte_rv)}</td>
              </tr>
            </tbody>
          </table>

          <p className="mt-2 text-[11px] text-slate-500">
            Prejuízo não é rateado com o parceiro: base negativa fica inteira com a RV. A base do
            rateio é ajustável obra a obra no cadastro da obra.
          </p>
        </Cartao>
      </div>
    </>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <tr>
      <td>{rotulo}</td>
      <td className="num">
        <Moeda valor={valor} />
      </td>
    </tr>
  )
}
