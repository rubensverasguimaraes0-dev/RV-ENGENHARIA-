import Link from 'next/link'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { criarClienteServidor } from '@/lib/supabase/server'
import { listarContratos, listarEquipamentos } from '@/lib/dados/locacao'
import { TituloPagina, Cartao, Indicador, Vazio, Etiqueta, Moeda } from '@/components/ui'
import { formatarData, formatarMoeda } from '@/lib/format'
import { FormularioContrato } from './formulario'
import { cancelarContrato } from './acoes'

const TOM: Record<string, 'ok' | 'alerta' | 'erro' | 'neutra'> = {
  aberto: 'ok',
  devolvido: 'neutra',
  atrasado: 'erro',
  cancelado: 'neutra',
}

export default async function PaginaLocacao() {
  await exigirAdmin()

  const supabase = await criarClienteServidor()
  const [contratos, equipamentos, { data: clientesData }, { data: obrasData }] = await Promise.all([
    listarContratos(),
    listarEquipamentos(),
    supabase.from('clientes').select('id, nome').is('excluido_em', null).order('nome'),
    supabase.from('obras').select('id, nome').is('excluido_em', null).order('nome'),
  ])

  const atrasados = contratos.filter((c) => c.status_atual === 'atrasado')
  const abertos = contratos.filter((c) => c.status_atual === 'aberto')
  const aReceber = contratos
    .filter((c) => !c.uso_interno && c.status_atual !== 'cancelado')
    .reduce((s, c) => s + c.apuracao.valor_total, 0)

  return (
    <>
      <TituloPagina
        titulo="Locação de equipamentos"
        subtitulo="Contratos, devolução e alertas de equipamento não devolvido"
        acoes={
          <Link href="/locacao/equipamentos" className="botao botao-neutro">
            Equipamentos e tabela de preços
          </Link>
        }
      />

      <div className="grid gap-2 sm:grid-cols-4 mb-3">
        <Indicador rotulo="Contratos abertos" valor={String(abertos.length)} tom="ok" />
        <Indicador
          rotulo="Em atraso"
          valor={String(atrasados.length)}
          tom={atrasados.length > 0 ? 'erro' : 'ok'}
        />
        <Indicador rotulo="Equipamentos" valor={String(equipamentos.length)} />
        <Indicador rotulo="Valor apurado" valor={formatarMoeda(aReceber)} />
      </div>

      {atrasados.length > 0 && (
        <div className="mb-3 rounded border border-erro-700/40 bg-erro-100 px-3 py-2">
          <p className="text-sm font-bold text-erro-700">
            {atrasados.length} equipamento(s) não devolvido(s) no prazo:
          </p>
          <ul className="mt-1 text-xs text-erro-700 list-disc pl-5">
            {atrasados.map((c) => (
              <li key={c.id}>
                <Link href={`/locacao/${c.id}`} className="underline">
                  {c.cliente_nome ?? c.obra_nome ?? 'contrato'}
                </Link>{' '}
                — previsto para {c.data_prevista ? formatarData(c.data_prevista) : '—'},{' '}
                {c.apuracao.dias_adicionais} dia(s) além, {formatarMoeda(c.apuracao.valor_adicional)}{' '}
                em diárias adicionais.
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <Cartao titulo={`Contratos (${contratos.length})`}>
          {contratos.length === 0 ? (
            <Vazio acao={{ href: "/locacao/equipamentos", rotulo: "Ver equipamentos" }}>
              Nenhum contrato de locação. Os equipamentos precisam estar cadastrados com a tabela de
              preços antes do primeiro contrato.
            </Vazio>
          ) : (
            <div className="rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Cliente / obra</th>
                    <th>Equipamentos</th>
                    <th>Saída</th>
                    <th>Devolução</th>
                    <th className="num">Valor</th>
                    <th>Situação</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {contratos.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/locacao/${c.id}`} className="font-semibold text-rv-700 underline">
                          {c.uso_interno ? c.obra_nome ?? 'obra' : c.cliente_nome ?? '—'}
                        </Link>
                        {c.uso_interno && (
                          <span className="ml-2 etiqueta etiqueta-alerta">uso interno</span>
                        )}
                      </td>
                      <td className="text-xs">
                        {c.itens.map((i) => `${i.quantidade}x ${i.descricao}`).join(', ') || '—'}
                      </td>
                      <td className="whitespace-nowrap">{formatarData(c.data_saida)}</td>
                      <td className="whitespace-nowrap">
                        {c.data_devolucao ? (
                          formatarData(c.data_devolucao)
                        ) : c.data_prevista ? (
                          <>
                            prev. {formatarData(c.data_prevista)}
                            {c.apuracao.dias_adicionais > 0 && (
                              <div className="text-[10px] text-erro-700">
                                +{c.apuracao.dias_adicionais} dia(s)
                              </div>
                            )}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="num">
                        {c.uso_interno ? (
                          <span className="text-slate-500 text-xs">custo interno</span>
                        ) : (
                          <Moeda valor={c.apuracao.valor_total} />
                        )}
                      </td>
                      <td>
                        <Etiqueta tom={TOM[c.status_atual] ?? 'neutra'}>{c.status_atual}</Etiqueta>
                      </td>
                      <td>
                        {c.status_atual !== 'devolvido' && c.status_atual !== 'cancelado' && (
                          <form action={cancelarContrato}>
                            <input type="hidden" name="id" value={c.id} />
                            <button className="acao acao-perigo" type="submit">
                              cancelar
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Cartao>

        <Cartao titulo="Novo contrato">
          {equipamentos.length === 0 ? (
            <p className="text-sm text-slate-600">
              Cadastre os equipamentos primeiro em{' '}
              <Link href="/locacao/equipamentos" className="acao acao-neutra">
                Equipamentos
              </Link>
              .
            </p>
          ) : (
            <FormularioContrato
              clientes={(clientesData ?? []) as { id: string; nome: string }[]}
              obras={(obrasData ?? []) as { id: string; nome: string }[]}
              equipamentos={equipamentos}
            />
          )}
        </Cartao>
      </div>
    </>
  )
}
