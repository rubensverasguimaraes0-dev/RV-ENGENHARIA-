import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { carregarFechamento } from '@/lib/dados/semana'
import { carregarParametros, dadosEmpresa } from '@/lib/parametros'
import { Documento, BlocoDados, BarraImpressao } from '@/components/documento'
import { BotaoImprimir } from '@/components/botao-imprimir'
import { formatarData, formatarMoeda, nomeDoDia } from '@/lib/format'
import Link from 'next/link'

/**
 * Fechamento da semana em uma unica pagina A4 (spec 4.5).
 * Semanas diferentes nunca somam entre si — este documento fecha em si mesmo.
 */
export default async function RelatorioSemanal({
  params,
}: {
  params: Promise<{ obraId: string; semanaId: string }>
}) {
  const { obraId, semanaId } = await params
  await exigirAdmin()

  const [obra, f, parametros] = await Promise.all([
    carregarObra(obraId),
    carregarFechamento(obraId, semanaId),
    carregarParametros(),
  ])
  if (!obra || !f) notFound()

  const empresa = dadosEmpresa(parametros)
  const cliente = obra.pagador ?? obra.cliente

  return (
    <>
      <BarraImpressao>
        <Link href={`/obras/${obraId}/semanas/${semanaId}`} className="botao botao-neutro">
          Voltar
        </Link>
        <BotaoImprimir />
        <Link href={`/api/obras/${obraId}/semanas/${semanaId}/planilha`} className="botao botao-neutro">
          Planilha (xlsx)
        </Link>
      </BarraImpressao>

      <Documento
        empresa={empresa}
        titulo={`Semana ${f.semana.numero}`}
        subtitulo="Fechamento semanal da equipe"
        geradoEm={new Date()}
        cabecalho={
          <BlocoDados
            itens={[
              { rotulo: 'Cliente', valor: cliente?.nome ?? '—' },
              { rotulo: 'Obra', valor: obra.nome },
              {
                rotulo: 'Período',
                valor: `${formatarData(f.semana.data_inicio)} a ${formatarData(f.semana.data_fim)}`,
              },
              { rotulo: 'Local', valor: obra.endereco ?? '—' },
            ]}
          />
        }
      >
        <table className="tabela mb-3">
          <thead>
            <tr>
              <th>Funcionário</th>
              <th>Função</th>
              <th className="num">Dias</th>
              <th className="num">Diárias</th>
              <th className="num">Vales</th>
              <th className="num">Líquido</th>
            </tr>
          </thead>
          <tbody>
            {f.funcionarios.map((r) => (
              <tr key={r.funcionario_id}>
                <td>{r.nome}</td>
                <td>{r.funcao}</td>
                <td className="num">
                  {r.dias_trabalhados}
                  {r.dias_meios > 0 ? ` (${r.dias_meios} meia)` : ''}
                </td>
                <td className="num">{formatarMoeda(r.total_diarias)}</td>
                <td className="num">{r.total_vales > 0 ? formatarMoeda(r.total_vales) : '—'}</td>
                <td className="num">{formatarMoeda(r.liquido)}</td>
              </tr>
            ))}
            <tr className="subtotal">
              <td colSpan={3}>Total de mão de obra</td>
              <td className="num">{formatarMoeda(f.total_mao_obra)}</td>
              <td className="num">{formatarMoeda(f.total_vales)}</td>
              <td className="num">{formatarMoeda(f.total_liquido)}</td>
            </tr>
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-3">
          <table className="tabela">
            <thead>
              <tr>
                <th colSpan={3}>Quentinhas por faixa de valor</th>
              </tr>
              <tr>
                <th className="num">Valor unit.</th>
                <th className="num">Qtd.</th>
                <th className="num">Custo</th>
              </tr>
            </thead>
            <tbody>
              {f.faixas_quentinha.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center text-slate-500">
                    sem quentinhas na semana
                  </td>
                </tr>
              ) : (
                f.faixas_quentinha.map((faixa) => (
                  <tr key={faixa.valor_unitario}>
                    <td className="num">{formatarMoeda(faixa.valor_unitario)}</td>
                    <td className="num">{faixa.quantidade}</td>
                    <td className="num">{formatarMoeda(faixa.total)}</td>
                  </tr>
                ))
              )}
              <tr className="subtotal">
                <td>Total</td>
                <td className="num">{f.qtd_quentinhas}</td>
                <td className="num">{formatarMoeda(f.total_quentinhas)}</td>
              </tr>
            </tbody>
          </table>

          <table className="tabela">
            <thead>
              <tr>
                <th colSpan={4}>Presenças por dia</th>
              </tr>
              <tr>
                <th>Dia</th>
                <th className="num">Presentes</th>
                <th className="num">Quentinhas</th>
                <th className="num">Total do dia</th>
              </tr>
            </thead>
            <tbody>
              {f.dias.map((d) => (
                <tr key={d.data}>
                  <td>
                    {nomeDoDia(d.data)} {formatarData(d.data).slice(0, 5)}
                  </td>
                  <td className="num">{d.qtd_presentes}</td>
                  <td className="num">{d.qtd_quentinhas}</td>
                  <td className="num">{formatarMoeda(d.total_dia)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Custo da semana</td>
                <td className="num"></td>
                <td className="num"></td>
                <td className="num">{formatarMoeda(f.custo_semana)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {f.semana.dias_sem_expediente.length > 0 && (
          <p className="mt-2 text-[10px] text-slate-600">
            Sem expediente: {f.semana.dias_sem_expediente.map(formatarData).join(', ')}.
          </p>
        )}
      </Documento>
    </>
  )
}
