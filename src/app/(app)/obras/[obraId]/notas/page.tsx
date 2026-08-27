import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirUsuario } from '@/lib/supabase/sessao'
import { criarClienteServidor } from '@/lib/supabase/server'
import { listarObrasVisiveis } from '@/lib/dados/obra'
import { listarDespesas, listarNotas } from '@/lib/dados/notas'
import { listarSemanas } from '@/lib/dados/semana'
import { totalizarNotas, verificarPendencias } from '@/lib/domain/notas'
import { TituloPagina, Cartao, Indicador, Etiqueta, Vazio, Moeda } from '@/components/ui'
import { formatarData, formatarMoeda } from '@/lib/format'
import { alternarConferida, alternarAConfirmar, arquivarNota } from './acoes'
import { PainelRepasse, FormularioDespesa, FormularioRateio } from './painel'

const ROTULO_CATEGORIA: Record<string, string> = {
  material: 'Material',
  locacao: 'Locação',
  cacamba: 'Caçamba',
  terceiro: 'Terceiro',
  combustivel: 'Combustível',
  outro: 'Outro',
}

export default async function PaginaNotas({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>
  searchParams: Promise<{ semana?: string; rateio?: string }>
}) {
  const { obraId } = await params
  const { semana: semanaParam, rateio: rateioParam } = await searchParams
  const usuario = await exigirUsuario()
  const ehAdmin = usuario.perfil === 'admin'

  const obras = await listarObrasVisiveis()
  const obra = obras.find((o) => o.id === obraId)
  if (!obra) notFound()

  const semanas = ehAdmin ? await listarSemanas(obraId) : []
  const semanaId = semanaParam === 'todas' ? null : semanaParam ?? semanas[0]?.id ?? null

  const supabase = await criarClienteServidor()
  const [notas, despesas, { data: locaisData }] = await Promise.all([
    listarNotas(obraId, { semanaId }),
    ehAdmin ? listarDespesas(obraId, semanaId) : Promise.resolve([]),
    supabase.from('locais_visiveis').select('id, nome').eq('obra_id', obraId).order('nome'),
  ])

  const locais = (locaisData ?? []) as { id: string; nome: string }[]
  const nomeLocal = new Map(locais.map((l) => [l.id, l.nome]))
  const totais = totalizarNotas(notas)
  const { bloqueios, alertas } = verificarPendencias(notas)
  const conferidas = notas.filter((n) => n.conferida).length
  const semanaAtual = semanas.find((s) => s.id === semanaId)
  const emRateio = rateioParam ? notas.find((n) => n.id === rateioParam) : null

  return (
    <>
      <TituloPagina
        titulo="Notas fiscais"
        subtitulo={
          <>
            {obra.nome}
            {semanaAtual
              ? ` · Semana ${semanaAtual.numero} (${formatarData(semanaAtual.data_inicio)} a ${formatarData(semanaAtual.data_fim)})`
              : ' · todas as semanas'}
          </>
        }
        acoes={
          <>
            <Link href={`/obras/${obraId}/notas/nova`} className="botao botao-primario">
              Nova nota
            </Link>
            {ehAdmin && (
              <Link
                href={`/obras/${obraId}/relatorio-despesas${semanaId ? `?semana=${semanaId}` : ''}`}
                className="botao botao-neutro"
              >
                Relatório ao cliente
              </Link>
            )}
          </>
        }
      />

      {ehAdmin && semanas.length > 0 && (
        <div className="cartao p-2 mb-3 flex flex-wrap gap-1 items-center">
          <span className="rotulo mb-0 mr-1">Semana:</span>
          {semanas.slice(0, 10).map((s) => (
            <Link
              key={s.id}
              href={`/obras/${obraId}/notas?semana=${s.id}`}
              className={`px-2 py-1 rounded text-xs font-semibold ${
                s.id === semanaId ? 'bg-rv-800 text-white' : 'bg-rv-50 text-rv-800'
              }`}
            >
              {s.numero}
            </Link>
          ))}
          <Link
            href={`/obras/${obraId}/notas?semana=todas`}
            className={`px-2 py-1 rounded text-xs font-semibold ${
              semanaId === null ? 'bg-rv-800 text-white' : 'bg-rv-50 text-rv-800'
            }`}
          >
            todas
          </Link>
        </div>
      )}

      {ehAdmin && (
        <div className="grid gap-2 sm:grid-cols-4 mb-3">
          <Indicador rotulo="Notas" valor={String(notas.length)} detalhe={`${conferidas} conferida(s)`} />
          <Indicador rotulo="A repassar à RV" valor={formatarMoeda(totais.a_repassar)} tom="ok" />
          <Indicador
            rotulo="Pago pelo cliente"
            valor={formatarMoeda(totais.pago_pelo_cliente)}
            detalhe="não entra no repasse"
          />
          <Indicador
            rotulo="Pendências"
            valor={String(bloqueios.length + alertas.length)}
            tom={bloqueios.length > 0 ? 'erro' : alertas.length > 0 ? 'alerta' : 'ok'}
          />
        </div>
      )}

      {bloqueios.length > 0 && (
        <div className="mb-3 rounded border border-erro-700/40 bg-erro-100 px-3 py-2">
          <p className="text-sm font-bold text-erro-700">
            {bloqueios.length} nota(s) impedem a geração do relatório:
          </p>
          <ul className="mt-1 text-xs text-erro-700 list-disc pl-5">
            {bloqueios.map((b) => (
              <li key={b.nota_id}>
                {b.descricao} — {b.problemas.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {alertas.length > 0 && (
        <div className="mb-3 rounded border border-alerta-700/40 bg-alerta-100 px-3 py-2">
          <p className="text-sm font-bold text-alerta-700">Avisos antes de enviar ao cliente:</p>
          <ul className="mt-1 text-xs text-alerta-700 list-disc pl-5">
            {alertas.map((a) => (
              <li key={a.nota_id}>
                {a.descricao} — {a.problemas.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        <Cartao titulo={`Checklist da semana (${notas.length} nota(s))`}>
          {notas.length === 0 ? (
            <Vazio>Nenhuma nota lançada neste período.</Vazio>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th className="w-16">Foto</th>
                    <th>Data</th>
                    <th>Fornecedor</th>
                    <th>Descrição</th>
                    <th className="num">Valor</th>
                    <th>Quem pagou</th>
                    {ehAdmin && <th>Situação</th>}
                    {ehAdmin && <th className="w-28"></th>}
                  </tr>
                </thead>
                <tbody>
                  {notas.map((n) => (
                    <tr key={n.id}>
                      <td>
                        {n.fotos[0]?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={n.fotos[0].url}
                            alt="nota"
                            className="h-12 w-12 object-cover rounded border border-slate-300"
                          />
                        ) : (
                          <Etiqueta tom="erro">sem foto</Etiqueta>
                        )}
                        {n.qtd_fotos > 1 && (
                          <div className="text-[10px] text-slate-500">{n.qtd_fotos} fotos</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap">{formatarData(n.data)}</td>
                      <td>
                        <div className="font-semibold">{n.fornecedor_nome || '—'}</div>
                        {n.numero_nota && (
                          <div className="text-[10px] text-slate-500">NF {n.numero_nota}</div>
                        )}
                      </td>
                      <td>
                        {n.descricao || '—'}
                        <div className="text-[10px] text-slate-500">
                          {ROTULO_CATEGORIA[n.categoria] ?? n.categoria}
                          {n.local_id && ` · ${nomeLocal.get(n.local_id) ?? 'local'}`}
                          {n.rateio.length > 0 && ` · rateada em ${n.rateio.length} locais`}
                        </div>
                        {ehAdmin && n.anotacao_interna && (
                          <div className="text-[10px] text-alerta-700">
                            interno: {n.anotacao_interna}
                          </div>
                        )}
                      </td>
                      <td className="num">
                        <Moeda valor={n.valor} />
                      </td>
                      <td>
                        {n.pago_por === 'rv' ? (
                          <Etiqueta tom="ok">RV</Etiqueta>
                        ) : (
                          <Etiqueta tom="alerta">Cliente</Etiqueta>
                        )}
                      </td>
                      {ehAdmin && (
                        <td className="space-y-0.5">
                          {n.conferida ? (
                            <Etiqueta tom="ok">conferida</Etiqueta>
                          ) : (
                            <Etiqueta tom="neutra">a conferir</Etiqueta>
                          )}
                          {n.repassada_em && (
                            <div className="text-[10px] text-slate-500">
                              repassada {formatarData(n.repassada_em)}
                            </div>
                          )}
                          {n.a_confirmar && <Etiqueta tom="alerta">local a confirmar</Etiqueta>}
                        </td>
                      )}
                      {ehAdmin && (
                        <td className="whitespace-nowrap text-xs space-y-0.5">
                          <form action={alternarConferida}>
                            <input type="hidden" name="id" value={n.id} />
                            <input type="hidden" name="obra_id" value={obraId} />
                            <input type="hidden" name="conferida" value={String(n.conferida)} />
                            <button className="text-rv-700 underline" type="submit">
                              {n.conferida ? 'desmarcar' : 'conferir'}
                            </button>
                          </form>
                          {locais.length > 0 && (
                            <Link
                              href={`/obras/${obraId}/notas?semana=${semanaParam ?? 'todas'}&rateio=${n.id}`}
                              className="text-rv-700 underline block"
                            >
                              ratear
                            </Link>
                          )}
                          <form action={alternarAConfirmar}>
                            <input type="hidden" name="id" value={n.id} />
                            <input type="hidden" name="obra_id" value={obraId} />
                            <input type="hidden" name="a_confirmar" value={String(n.a_confirmar)} />
                            <button className="text-alerta-700 underline" type="submit">
                              {n.a_confirmar ? 'confirmar local' : 'a confirmar'}
                            </button>
                          </form>
                          <form action={arquivarNota}>
                            <input type="hidden" name="id" value={n.id} />
                            <input type="hidden" name="obra_id" value={obraId} />
                            <button className="text-erro-700 underline" type="submit">
                              arquivar
                            </button>
                          </form>
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="subtotal">
                    <td colSpan={4}>A repassar à RV ({totais.qtd_a_repassar} nota(s))</td>
                    <td className="num">{formatarMoeda(totais.a_repassar)}</td>
                    <td colSpan={ehAdmin ? 3 : 1}></td>
                  </tr>
                  <tr className="subtotal">
                    <td colSpan={4}>
                      Pago pelo cliente na loja ({totais.qtd_pago_pelo_cliente} nota(s)) — não
                      repassar
                    </td>
                    <td className="num">{formatarMoeda(totais.pago_pelo_cliente)}</td>
                    <td colSpan={ehAdmin ? 3 : 1}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Cartao>

        {ehAdmin && emRateio && locais.length > 0 && (
          <Cartao titulo={`Ratear nota de ${formatarMoeda(emRateio.valor)} entre os locais`}>
            <FormularioRateio
              obraId={obraId}
              nota={{ id: emRateio.id, valor: emRateio.valor }}
              locais={locais}
              rateioAtual={emRateio.rateio}
            />
            <Link
              href={`/obras/${obraId}/notas?semana=${semanaParam ?? 'todas'}`}
              className="botao botao-neutro mt-2"
            >
              Fechar
            </Link>
          </Cartao>
        )}

        {ehAdmin && (
          <div className="grid gap-3 lg:grid-cols-2">
            <Cartao titulo="Despesas sem nota fiscal">
              {despesas.length > 0 && (
                <table className="tabela mb-3">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Descrição</th>
                      <th>Pago a</th>
                      <th className="num">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {despesas.map((d) => (
                      <tr key={d.id}>
                        <td className="whitespace-nowrap">{formatarData(d.data)}</td>
                        <td>
                          {d.descricao}
                          {d.repassar_cliente && (
                            <span className="ml-2 etiqueta etiqueta-alerta">repassar</span>
                          )}
                        </td>
                        <td>{d.pago_a ?? '—'}</td>
                        <td className="num">
                          <Moeda valor={d.valor} />
                        </td>
                      </tr>
                    ))}
                    <tr className="subtotal">
                      <td colSpan={3}>Total (entra no custo da obra)</td>
                      <td className="num">
                        {formatarMoeda(despesas.reduce((s, d) => s + d.valor, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
              <FormularioDespesa obraId={obraId} locais={locais} />
            </Cartao>

            <Cartao titulo="Marcar notas como repassadas ao cliente">
              <PainelRepasse
                obraId={obraId}
                notas={notas
                  .filter((n) => n.pago_por === 'rv' && !n.repassada_em)
                  .map((n) => ({
                    id: n.id,
                    rotulo: `${formatarData(n.data)} — ${n.fornecedor_nome || 'sem fornecedor'}`,
                    valor: n.valor,
                    temFoto: n.qtd_fotos > 0,
                  }))}
              />
            </Cartao>
          </div>
        )}
      </div>
    </>
  )
}
