import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { listarNotas } from '@/lib/dados/notas'
import { listarSemanas } from '@/lib/dados/semana'
import { criarClienteServidor } from '@/lib/supabase/server'
import { carregarParametros, dadosEmpresa } from '@/lib/parametros'
import { totalizarNotas, verificarPendencias, subtotaisPorLocal } from '@/lib/domain/notas'
import { Documento, BlocoDados, BarraImpressao } from '@/components/documento'
import { BotaoImprimir } from '@/components/botao-imprimir'
import { formatarData, formatarMoeda } from '@/lib/format'

const ROTULO_CATEGORIA: Record<string, string> = {
  material: 'Material',
  locacao: 'Locação',
  cacamba: 'Caçamba',
  terceiro: 'Serviço de terceiro',
  combustivel: 'Combustível',
  outro: 'Outro',
}

/**
 * Relatorio de despesas ao cliente (spec 4.8), em dois formatos:
 *  - resumo de 1 pagina: data, fornecedor, descricao e valor, com os dois totais
 *  - completo: o mesmo resumo seguido do anexo com as fotos das notas
 *
 * Nenhuma nota sem foto entra no relatorio: o app barra e aponta quais faltam.
 */
export default async function RelatorioDespesas({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>
  searchParams: Promise<{ semana?: string; formato?: string }>
}) {
  const { obraId } = await params
  const { semana: semanaParam, formato } = await searchParams
  await exigirAdmin()

  const obra = await carregarObra(obraId)
  if (!obra) notFound()

  const semanas = await listarSemanas(obraId)
  const semanaId = semanaParam && semanaParam !== 'todas' ? semanaParam : null
  const semana = semanas.find((s) => s.id === semanaId)

  const [notas, parametros, supabase] = await Promise.all([
    listarNotas(obraId, { semanaId }),
    carregarParametros(),
    criarClienteServidor(),
  ])
  const { data: locaisData } = await supabase
    .from('locais_obra')
    .select('id, nome')
    .eq('obra_id', obraId)
    .is('excluido_em', null)
    .order('nome')

  const locais = (locaisData ?? []) as { id: string; nome: string }[]
  const nomeLocal = new Map(locais.map((l) => [l.id, l.nome]))
  const empresa = dadosEmpresa(parametros)
  const cliente = obra.pagador ?? obra.cliente

  const { bloqueios, alertas } = verificarPendencias(notas)
  const completo = formato === 'completo'

  const daRv = notas.filter((n) => n.pago_por === 'rv')
  const doCliente = notas.filter((n) => n.pago_por === 'cliente')
  const totais = totalizarNotas(notas)

  const porLocal = subtotaisPorLocal(
    notas,
    notas.flatMap((n) => n.rateio.map((r) => ({ id: '', nota_id: n.id, ...r, obra_id: obraId }))),
    new Map(notas.map((n) => [n.id, n.local_id])),
  )
  const mostrarPorLocal = locais.length > 1 && porLocal.length > 1

  return (
    <>
      <BarraImpressao>
        <Link href={`/obras/${obraId}/notas`} className="botao botao-neutro">
          Voltar
        </Link>
        <BotaoImprimir />
        <Link
          href={`/obras/${obraId}/relatorio-despesas?semana=${semanaParam ?? 'todas'}&formato=${
            completo ? 'resumo' : 'completo'
          }`}
          className="botao botao-neutro"
        >
          {completo ? 'Ver só o resumo (1 página)' : 'Ver completo (com as fotos)'}
        </Link>
      </BarraImpressao>

      {bloqueios.length > 0 && (
        <div className="nao-imprimir mx-auto my-3 max-w-[210mm] rounded border border-erro-700 bg-erro-100 px-3 py-2">
          <p className="text-sm font-bold text-erro-700">
            Este relatório não pode ser enviado: {bloqueios.length} nota(s) com pendência.
          </p>
          <ul className="mt-1 text-xs text-erro-700 list-disc pl-5">
            {bloqueios.map((b) => (
              <li key={b.nota_id}>
                {b.descricao} — {b.problemas.join(', ')}
              </li>
            ))}
          </ul>
          <Link href={`/obras/${obraId}/notas`} className="botao botao-neutro mt-2">
            Resolver pendências
          </Link>
        </div>
      )}

      {alertas.length > 0 && (
        <div className="nao-imprimir mx-auto my-3 max-w-[210mm] rounded border border-alerta-700 bg-alerta-100 px-3 py-2 text-xs text-alerta-700">
          <strong>Avisos:</strong>{' '}
          {alertas.map((a) => `${a.descricao} (${a.problemas.join(', ')})`).join(' · ')}
        </div>
      )}

      <Documento
        empresa={empresa}
        titulo="Relatório de despesas"
        subtitulo={semana ? `Semana ${semana.numero}` : 'Consolidado da obra'}
        geradoEm={new Date()}
        cabecalho={
          <BlocoDados
            itens={[
              { rotulo: 'Cliente', valor: cliente?.nome ?? '—' },
              { rotulo: 'Obra', valor: obra.nome },
              {
                rotulo: 'Período',
                valor: semana
                  ? `${formatarData(semana.data_inicio)} a ${formatarData(semana.data_fim)}`
                  : 'todas as semanas lançadas',
              },
              { rotulo: 'Local', valor: obra.endereco ?? '—' },
            ]}
          />
        }
      >
        <table className="tabela">
          <thead>
            <tr>
              <th>Data</th>
              <th>Fornecedor</th>
              <th>Descrição</th>
              <th>Tipo</th>
              <th className="num">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr className="secao">
              <td colSpan={5}>Despesas a repassar à RV Engenharia</td>
            </tr>
            {daRv.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-slate-500">
                  nenhuma despesa a repassar no período
                </td>
              </tr>
            ) : (
              daRv.map((n) => (
                <tr key={n.id}>
                  <td className="whitespace-nowrap">{formatarData(n.data)}</td>
                  <td>
                    {n.fornecedor_nome || '—'}
                    {n.numero_nota && (
                      <span className="text-[10px] text-slate-500"> · NF {n.numero_nota}</span>
                    )}
                  </td>
                  <td>
                    {n.descricao || '—'}
                    {n.local_id && (
                      <span className="text-[10px] text-slate-500">
                        {' '}
                        · {nomeLocal.get(n.local_id) ?? ''}
                      </span>
                    )}
                  </td>
                  <td>{ROTULO_CATEGORIA[n.categoria] ?? n.categoria}</td>
                  <td className="num">{formatarMoeda(n.valor)}</td>
                </tr>
              ))
            )}
            <tr className="total">
              <td colSpan={4}>Total a repassar à RV Engenharia</td>
              <td className="num">{formatarMoeda(totais.a_repassar)}</td>
            </tr>

            {doCliente.length > 0 && (
              <>
                <tr className="secao">
                  <td colSpan={5}>Pago pelo cliente na loja — apenas para controle</td>
                </tr>
                {doCliente.map((n) => (
                  <tr key={n.id}>
                    <td className="whitespace-nowrap">{formatarData(n.data)}</td>
                    <td>{n.fornecedor_nome || '—'}</td>
                    <td>{n.descricao || '—'}</td>
                    <td>{ROTULO_CATEGORIA[n.categoria] ?? n.categoria}</td>
                    <td className="num">{formatarMoeda(n.valor)}</td>
                  </tr>
                ))}
                <tr className="subtotal">
                  <td colSpan={4}>Total pago pelo cliente — não repassar</td>
                  <td className="num">{formatarMoeda(totais.pago_pelo_cliente)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        {mostrarPorLocal && (
          <table className="tabela mt-3">
            <thead>
              <tr>
                <th>Subtotal por local</th>
                <th className="num">A repassar</th>
                <th className="num">Pago pelo cliente</th>
              </tr>
            </thead>
            <tbody>
              {porLocal.map((s) => (
                <tr key={s.local_id ?? 'sem-local'}>
                  <td>{s.local_id ? nomeLocal.get(s.local_id) ?? '—' : 'sem local definido'}</td>
                  <td className="num">{formatarMoeda(s.a_repassar)}</td>
                  <td className="num">{formatarMoeda(s.pago_pelo_cliente)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="mt-3 text-[10px] text-slate-600">
          As notas fiscais correspondentes estão anexadas
          {completo ? ' a este documento' : ' na versão completa deste relatório'}.
        </p>
      </Documento>

      {completo &&
        notas
          .filter((n) => n.fotos.length > 0)
          .map((n, i) => (
            <div key={n.id} className={i === 0 ? 'quebra-pagina' : 'quebra-pagina'}>
              <Documento
                empresa={empresa}
                titulo="Anexo — nota fiscal"
                subtitulo={`${formatarData(n.data)} · ${n.fornecedor_nome || 'sem fornecedor'}`}
                assinar={false}
                cabecalho={
                  <BlocoDados
                    itens={[
                      { rotulo: 'Fornecedor', valor: n.fornecedor_nome || '—' },
                      { rotulo: 'Nota', valor: n.numero_nota ?? '—' },
                      { rotulo: 'Data', valor: formatarData(n.data) },
                      { rotulo: 'Valor', valor: formatarMoeda(n.valor) },
                      { rotulo: 'Descrição', valor: n.descricao || '—' },
                      {
                        rotulo: 'Pago por',
                        valor: n.pago_por === 'rv' ? 'RV Engenharia' : 'Cliente na loja',
                      },
                    ]}
                  />
                }
              >
                <div className="grid gap-2 grid-cols-1">
                  {n.fotos.map((f) =>
                    f.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={f.caminho}
                        src={f.url}
                        alt={`Nota ${n.numero_nota ?? ''}`}
                        className="w-full max-h-[190mm] object-contain border border-slate-300"
                      />
                    ) : null,
                  )}
                </div>
              </Documento>
            </div>
          ))}
    </>
  )
}
