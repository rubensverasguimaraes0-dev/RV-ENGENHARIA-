import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { carregarFechamento } from '@/lib/dados/semana'
import { TituloPagina, Cartao, Indicador, Etiqueta, Moeda } from '@/components/ui'
import { formatarData, formatarMoeda, nomeDoDia } from '@/lib/format'
import { ROTULO_TIPO_DIARIA } from '@/lib/domain/lancamento'
import { FormularioFechamento } from './formulario'
import { reabrirSemana } from '../acoes'

export default async function PaginaFechamentoSemana({
  params,
}: {
  params: Promise<{ obraId: string; semanaId: string }>
}) {
  const { obraId, semanaId } = await params
  await exigirAdmin()

  const obra = await carregarObra(obraId)
  if (!obra) notFound()

  const f = await carregarFechamento(obraId, semanaId)
  if (!f) notFound()

  const fechada = f.semana.status === 'fechada'

  return (
    <>
      <TituloPagina
        titulo={`Semana ${f.semana.numero}`}
        subtitulo={
          <>
            {obra.nome} · {formatarData(f.semana.data_inicio)} a {formatarData(f.semana.data_fim)}{' '}
            {fechada ? <Etiqueta tom="neutra">Fechada</Etiqueta> : <Etiqueta tom="ok">Aberta</Etiqueta>}
          </>
        }
        acoes={
          <>
            <Link
              href={`/obras/${obraId}/semanas/${semanaId}/relatorio`}
              className="botao botao-primario"
            >
              Relatório (PDF)
            </Link>
            <Link
              href={`/api/obras/${obraId}/semanas/${semanaId}/planilha`}
              className="botao botao-neutro"
            >
              Planilha (xlsx)
            </Link>
            <Link
              href={`/obras/${obraId}/semanas/${semanaId}/recibos`}
              className="botao botao-neutro"
            >
              Recibos
            </Link>
          </>
        }
      />

      <div className="grid gap-2 sm:grid-cols-4 mb-3">
        <Indicador rotulo="Mão de obra" valor={formatarMoeda(f.total_mao_obra)} />
        <Indicador
          rotulo="Quentinhas"
          valor={formatarMoeda(f.total_quentinhas)}
          detalhe={`${f.qtd_quentinhas} unidade(s)`}
        />
        <Indicador rotulo="Vales" valor={formatarMoeda(f.total_vales)} tom="alerta" />
        <Indicador rotulo="Custo da semana" valor={formatarMoeda(f.custo_semana)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <Cartao titulo="Resumo por funcionário">
            {f.funcionarios.length === 0 ? (
              <p className="text-sm text-slate-600">
                Nenhuma presença lançada nesta semana. Só aparece no relatório quem efetivamente
                trabalhou.
              </p>
            ) : (
              <table className="tabela">
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
                      <td>
                        {r.nome}
                        {r.tipo === 'parceiro' && (
                          <span className="ml-2 etiqueta etiqueta-alerta">Parceiro</span>
                        )}
                      </td>
                      <td>{r.funcao}</td>
                      <td className="num">
                        {r.dias_trabalhados}
                        {r.dias_meios > 0 && (
                          <span className="text-[11px] text-slate-500"> ({r.dias_meios} meia)</span>
                        )}
                      </td>
                      <td className="num">
                        <Moeda valor={r.total_diarias} />
                      </td>
                      <td className="num">
                        <Moeda valor={r.total_vales} />
                      </td>
                      <td className="num font-semibold">
                        <Moeda valor={r.liquido} />
                      </td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td colSpan={3}>Total</td>
                    <td className="num">{formatarMoeda(f.total_mao_obra)}</td>
                    <td className="num">{formatarMoeda(f.total_vales)}</td>
                    <td className="num">{formatarMoeda(f.total_liquido)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </Cartao>

          <Cartao titulo="Quentinhas por faixa de valor">
            {f.faixas_quentinha.length === 0 ? (
              <p className="text-sm text-slate-600">Nenhuma quentinha lançada nesta semana.</p>
            ) : (
              <table className="tabela">
                <thead>
                  <tr>
                    <th className="num">Valor unitário</th>
                    <th className="num">Quantidade</th>
                    <th className="num">Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {f.faixas_quentinha.map((faixa) => (
                    <tr key={faixa.valor_unitario}>
                      <td className="num">{formatarMoeda(faixa.valor_unitario)}</td>
                      <td className="num">{faixa.quantidade}</td>
                      <td className="num">
                        <Moeda valor={faixa.total} />
                      </td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>Total</td>
                    <td className="num">{f.qtd_quentinhas}</td>
                    <td className="num">{formatarMoeda(f.total_quentinhas)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </Cartao>

          {f.dias.map((dia) => (
            <Cartao
              key={dia.data}
              titulo={`${nomeDoDia(dia.data)}, ${formatarData(dia.data)}${dia.sabado ? ' — sábado' : ''}`}
            >
              {dia.linhas.length === 0 && dia.quentinhas.length === 0 ? (
                <p className="text-sm text-slate-500">Sem lançamentos neste dia.</p>
              ) : (
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Funcionário</th>
                      <th>Tipo</th>
                      <th className="num">Diária</th>
                      <th className="num">Vale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dia.linhas.map((l) => (
                      <tr key={l.funcionario_id}>
                        <td>{l.nome}</td>
                        <td>{ROTULO_TIPO_DIARIA[l.tipo_diaria]}</td>
                        <td className="num">
                          <Moeda valor={l.valor_diaria} />
                        </td>
                        <td className="num">
                          {l.valor_vale > 0 ? <Moeda valor={l.valor_vale} /> : '—'}
                        </td>
                      </tr>
                    ))}
                    {dia.quentinhas.map((q) => (
                      <tr key={q.valor_unitario} className="secao">
                        <td colSpan={2}>
                          Quentinhas — {q.quantidade} x {formatarMoeda(q.valor_unitario)}
                        </td>
                        <td className="num" colSpan={2}>
                          {formatarMoeda(q.total)}
                        </td>
                      </tr>
                    ))}
                    <tr className="subtotal">
                      <td colSpan={2}>
                        Total do dia — {dia.qtd_presentes} presente(s), {dia.qtd_quentinhas}{' '}
                        quentinha(s)
                      </td>
                      <td className="num" colSpan={2}>
                        {formatarMoeda(dia.total_dia)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </Cartao>
          ))}
        </div>

        <div className="space-y-3">
          {fechada ? (
            <Cartao titulo="Semana fechada">
              <p className="text-sm text-slate-600 mb-3">
                Os lançamentos estão travados. Reabra para corrigir algum dia.
              </p>
              <form action={reabrirSemana}>
                <input type="hidden" name="semana_id" value={semanaId} />
                <input type="hidden" name="obra_id" value={obraId} />
                <button className="botao botao-neutro w-full" type="submit">
                  Reabrir semana
                </button>
              </form>
            </Cartao>
          ) : (
            <Cartao titulo="Fechar a semana">
              <FormularioFechamento
                obraId={obraId}
                semanaId={semanaId}
                dataInicio={f.semana.data_inicio}
                diasSemExpediente={f.semana.dias_sem_expediente}
              />
            </Cartao>
          )}
        </div>
      </div>
    </>
  )
}
