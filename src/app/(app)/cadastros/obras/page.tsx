import Link from 'next/link'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { criarClienteServidor } from '@/lib/supabase/server'
import { TituloPagina, Cartao, Vazio, Etiqueta, Moeda } from '@/components/ui'
import { formatarData } from '@/lib/format'
import { FormularioObra, FormularioLocal, type ObraForm } from './formulario'
import { arquivarObra, arquivarLocal } from './acoes'

const ROTULO_STATUS: Record<string, { texto: string; tom: 'ok' | 'alerta' | 'erro' | 'neutra' }> = {
  orcada: { texto: 'Orçada', tom: 'neutra' },
  em_andamento: { texto: 'Em andamento', tom: 'ok' },
  paralisada: { texto: 'Paralisada', tom: 'alerta' },
  concluida: { texto: 'Concluída', tom: 'neutra' },
}

const ROTULO_FORMA: Record<string, string> = {
  diaria: 'Por diária',
  empreitada: 'Empreitada global',
  medicao: 'Por medição',
  unidade: 'Por unidade replicada',
}

export default async function PaginaObrasCadastro({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>
}) {
  await exigirAdmin()
  const { editar } = await searchParams
  const supabase = await criarClienteServidor()

  const [{ data: obrasData }, { data: clientesData }, { data: locaisData }] = await Promise.all([
    supabase
      .from('obras')
      .select(
        'id, nome, cliente_id, cliente_pagador_id, endereco, tipo, forma_contratacao, data_inicio, data_prevista_fim, status, valor_contrato, percentual_rateio_parceiro, base_rateio_parceiro, observacoes',
      )
      .is('excluido_em', null)
      .order('nome'),
    supabase.from('clientes').select('id, nome').is('excluido_em', null).order('nome'),
    supabase.from('locais_obra').select('id, obra_id, nome, endereco').is('excluido_em', null).order('nome'),
  ])

  const obras = (obrasData ?? []) as ObraForm[]
  const clientes = (clientesData ?? []) as { id: string; nome: string }[]
  const locais = (locaisData ?? []) as { id: string; obra_id: string; nome: string; endereco: string | null }[]
  const nomeCliente = new Map(clientes.map((c) => [c.id, c.nome]))
  const emEdicao = editar ? obras.find((o) => o.id === editar) ?? null : null
  const locaisDaObra = emEdicao ? locais.filter((l) => l.obra_id === emEdicao.id) : []

  return (
    <>
      <TituloPagina
        titulo="Obras e locais"
        subtitulo="Uma obra pode ter vários locais — o relatório sai único, com um bloco por local"
      />

      {clientes.length === 0 && (
        <p className="mb-3 text-sm rounded border border-alerta-700/30 bg-alerta-100 text-alerta-700 px-3 py-2">
          Cadastre um cliente antes de criar a obra.{' '}
          <Link href="/cadastros/clientes" className="underline">
            Ir para clientes
          </Link>
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <Cartao titulo={`Obras (${obras.length})`}>
            {obras.length === 0 ? (
              <Vazio acao={{ href: "/cadastros/clientes", rotulo: "Cadastrar cliente" }}>
                Nenhuma obra cadastrada ainda. Toda obra pertence a um cliente.
              </Vazio>
            ) : (
              <div className="rolagem">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Obra</th>
                      <th>Cliente</th>
                      <th>Contratação</th>
                      <th className="num">Contrato</th>
                      <th>Situação</th>
                      <th className="w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {obras.map((o) => {
                      const st = ROTULO_STATUS[o.status] ?? ROTULO_STATUS.em_andamento!
                      const qtdLocais = locais.filter((l) => l.obra_id === o.id).length
                      return (
                        <tr key={o.id}>
                          <td>
                            <Link href={`/obras/${o.id}`} className="font-semibold text-rv-700 underline">
                              {o.nome}
                            </Link>
                            <div className="text-[11px] text-slate-500">
                              {o.data_inicio ? `início ${formatarData(o.data_inicio)}` : 'sem data de início'}
                              {qtdLocais > 0 && ` · ${qtdLocais} local(is)`}
                            </div>
                          </td>
                          <td>
                            {nomeCliente.get(o.cliente_id) ?? '—'}
                            {o.cliente_pagador_id && o.cliente_pagador_id !== o.cliente_id && (
                              <div className="text-[11px] text-slate-500">
                                paga: {nomeCliente.get(o.cliente_pagador_id) ?? '—'}
                              </div>
                            )}
                          </td>
                          <td>{ROTULO_FORMA[o.forma_contratacao] ?? o.forma_contratacao}</td>
                          <td className="num">
                            <Moeda valor={o.valor_contrato} />
                          </td>
                          <td>
                            <Etiqueta tom={st.tom}>{st.texto}</Etiqueta>
                          </td>
                          <td className="whitespace-nowrap">
                            <Link
                              href={`/cadastros/obras?editar=${o.id}`}
                              className="acao acao-neutra"
                            >
                              editar
                            </Link>
                            <form action={arquivarObra} className="inline">
                              <input type="hidden" name="id" value={o.id} />
                              <button className="acao acao-perigo" type="submit">
                                arquivar
                              </button>
                            </form>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Cartao>

          {emEdicao && (
            <Cartao titulo={`Locais de ${emEdicao.nome}`}>
              {locaisDaObra.length === 0 ? (
                <Vazio>
                  Sem locais separados. Adicione locais quando o mesmo cliente paga serviços em
                  endereços diferentes.
                </Vazio>
              ) : (
                <table className="tabela mb-3">
                  <thead>
                    <tr>
                      <th>Local</th>
                      <th>Endereço</th>
                      <th className="w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {locaisDaObra.map((l) => (
                      <tr key={l.id}>
                        <td className="font-semibold">{l.nome}</td>
                        <td>{l.endereco ?? '—'}</td>
                        <td>
                          <form action={arquivarLocal}>
                            <input type="hidden" name="id" value={l.id} />
                            <button className="acao acao-perigo" type="submit">
                              remover
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <FormularioLocal obraId={emEdicao.id} />
            </Cartao>
          )}
        </div>

        <Cartao titulo={emEdicao ? 'Editar obra' : 'Nova obra'}>
          <FormularioObra obra={emEdicao} clientes={clientes} />
          {emEdicao && (
            <Link href="/cadastros/obras" className="botao botao-neutro mt-2 w-full">
              Cancelar edição
            </Link>
          )}
        </Cartao>
      </div>
    </>
  )
}
