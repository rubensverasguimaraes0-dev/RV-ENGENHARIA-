import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarContrato } from '@/lib/dados/locacao'
import { saldoDoContrato } from '@/lib/domain/locacao'
import { TituloPagina, Cartao, Indicador, Etiqueta, Moeda } from '@/components/ui'
import { formatarData, formatarMoeda } from '@/lib/format'
import { FormularioDevolucao } from '../formulario'

export default async function DetalheContrato({
  params,
}: {
  params: Promise<{ contratoId: string }>
}) {
  const { contratoId } = await params
  await exigirAdmin()

  const contrato = await carregarContrato(contratoId)
  if (!contrato) notFound()

  const a = contrato.apuracao
  const saldo = saldoDoContrato(a.valor_total, contrato.caucao)
  const devolvido = contrato.status_atual === 'devolvido'

  return (
    <>
      <TituloPagina
        titulo={contrato.uso_interno ? contrato.obra_nome ?? 'Uso interno' : contrato.cliente_nome ?? 'Contrato'}
        subtitulo={
          <>
            Saída em {formatarData(contrato.data_saida)}
            {contrato.data_prevista && ` · devolução prevista ${formatarData(contrato.data_prevista)}`}
            <Etiqueta
              tom={
                contrato.status_atual === 'atrasado'
                  ? 'erro'
                  : contrato.status_atual === 'aberto'
                    ? 'ok'
                    : 'neutra'
              }
            >
              {contrato.status_atual}
            </Etiqueta>
          </>
        }
        acoes={
          <>
            <Link href={`/locacao/${contratoId}/contrato`} className="botao botao-primario">
              Contrato / recibo (PDF)
            </Link>
            <Link href="/locacao" className="botao botao-neutro">
              Todos os contratos
            </Link>
          </>
        }
      />

      {contrato.uso_interno && (
        <p className="mb-3 rounded border border-alerta-700/40 bg-alerta-100 text-alerta-700 px-3 py-2 text-sm">
          Uso interno: o valor apurado entra como custo da obra {contrato.obra_nome ?? ''} e não
          gera receita de locação.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-4 mb-3">
        <Indicador
          rotulo="Dias previstos"
          valor={String(a.dias_previstos)}
          detalhe={a.detalhe_previsto}
        />
        <Indicador
          rotulo="Dias efetivos"
          valor={String(a.dias_efetivos)}
          tom={a.dias_adicionais > 0 ? 'erro' : 'ok'}
          detalhe={a.dias_adicionais > 0 ? `${a.dias_adicionais} além do previsto` : 'no prazo'}
        />
        <Indicador rotulo="Valor apurado" valor={formatarMoeda(a.valor_total)} />
        <Indicador
          rotulo={contrato.caucao > 0 ? 'Saldo após caução' : 'A receber'}
          valor={formatarMoeda(saldo)}
          tom={saldo > 0 ? 'alerta' : 'ok'}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <Cartao titulo="Equipamentos e cobrança">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Equipamento</th>
                  <th className="num">Qtd.</th>
                  <th className="num">Diária</th>
                  <th className="num">Período previsto</th>
                  <th className="num">Adicional</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {a.itens.map((linha) => (
                  <tr key={linha.item.id}>
                    <td>{linha.item.descricao}</td>
                    <td className="num">{linha.item.quantidade}</td>
                    <td className="num">
                      <Moeda valor={linha.item.tabela.valor_diaria} />
                    </td>
                    <td className="num">
                      <Moeda valor={linha.valor_previsto} />
                    </td>
                    <td className="num">
                      {linha.valor_adicional > 0 ? <Moeda valor={linha.valor_adicional} /> : '—'}
                    </td>
                    <td className="num font-semibold">
                      <Moeda valor={linha.valor_total} />
                    </td>
                  </tr>
                ))}
                <tr className="subtotal">
                  <td colSpan={3}>
                    Período previsto — {a.dias_previstos} dia(s), {a.detalhe_previsto}
                  </td>
                  <td className="num">{formatarMoeda(a.valor_previsto)}</td>
                  <td className="num"></td>
                  <td className="num"></td>
                </tr>
                {a.valor_adicional > 0 && (
                  <tr className="subtotal">
                    <td colSpan={4}>
                      Diárias adicionais — {a.dias_adicionais} dia(s), {a.detalhe_adicional}
                    </td>
                    <td className="num">{formatarMoeda(a.valor_adicional)}</td>
                    <td className="num"></td>
                  </tr>
                )}
                {contrato.caucao > 0 && (
                  <tr>
                    <td colSpan={5}>Caução retida</td>
                    <td className="num">− {formatarMoeda(contrato.caucao)}</td>
                  </tr>
                )}
                <tr className="total">
                  <td colSpan={5}>
                    {contrato.uso_interno ? 'Custo interno da obra' : 'Valor a receber'}
                  </td>
                  <td className="num">
                    {formatarMoeda(contrato.uso_interno ? a.valor_total : saldo)}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-slate-500">
              A cobrança combina mês, semana e diária pelo que sai mais barato ao cliente — um
              equipamento devolvido no 29º dia nunca custa mais que no 30º.
            </p>
          </Cartao>

          {contrato.observacao && (
            <Cartao titulo="Observação">
              <p className="text-sm">{contrato.observacao}</p>
            </Cartao>
          )}
        </div>

        <div className="space-y-3">
          {devolvido ? (
            <Cartao titulo="Devolvido">
              <p className="text-sm text-slate-600">
                Devolvido em {contrato.data_devolucao ? formatarData(contrato.data_devolucao) : '—'},
                com valor final de {formatarMoeda(contrato.valor || a.valor_total)}.
              </p>
            </Cartao>
          ) : (
            <Cartao titulo="Registrar devolução">
              <FormularioDevolucao contrato={contrato} />
            </Cartao>
          )}
        </div>
      </div>
    </>
  )
}
