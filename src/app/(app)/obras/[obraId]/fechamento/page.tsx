import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { carregarFechamentoDebitos } from '@/lib/dados/fechamento'
import { criarClienteServidor } from '@/lib/supabase/server'
import { TituloPagina, Cartao, Indicador, Vazio, Moeda } from '@/components/ui'
import { formatarMoeda } from '@/lib/format'
import { SeletorVersao } from '@/components/seletor-versao'
import { FormularioServicoExecutado } from './formulario'
import { arquivarServicoExecutado, importarMedicoes } from './acoes'
import type { Agrupamento } from '@/lib/domain/fechamento-debitos'

export default async function PaginaFechamento({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>
  searchParams: Promise<{ editar?: string; agrupar?: string }>
}) {
  const { obraId } = await params
  const { editar, agrupar } = await searchParams
  await exigirAdmin()

  const obra = await carregarObra(obraId)
  if (!obra) notFound()

  const agrupamento: Agrupamento = agrupar === 'local' ? 'local' : 'grupo'
  const { fechamento: f, servicos } = await carregarFechamentoDebitos(obraId, agrupamento)

  const supabase = await criarClienteServidor()
  const [{ data: locaisData }, { data: documentosData }] = await Promise.all([
    supabase.from('locais_obra').select('id, nome').eq('obra_id', obraId).is('excluido_em', null).order('nome'),
    supabase
      .from('documentos')
      .select('id, tipo, referencia, gerado_em')
      .eq('obra_id', obraId)
      .is('excluido_em', null)
      .order('gerado_em', { ascending: false })
      .limit(8),
  ])

  const locais = (locaisData ?? []) as { id: string; nome: string }[]
  const documentos = (documentosData ?? []) as {
    id: string
    tipo: string
    referencia: string | null
    gerado_em: string
  }[]
  const emEdicao = editar ? servicos.find((s) => s.id === editar) ?? null : null

  return (
    <>
      <TituloPagina
        titulo="Fechamento de serviços"
        subtitulo={`${obra.nome} — o documento que fecha a conta com o cliente`}
        acoes={
          <Link href={`/obras/${obraId}`} className="botao botao-neutro">
            Voltar à obra
          </Link>
        }
      />

      <div className="grid gap-2 sm:grid-cols-4 mb-3">
        <Indicador
          rotulo="Serviços líquidos"
          valor={formatarMoeda(f.servicos_liquidos)}
          detalhe={f.total_deducoes > 0 ? `${formatarMoeda(f.total_deducoes)} em deduções` : undefined}
        />
        <Indicador rotulo="Adiantamentos" valor={formatarMoeda(f.total_adiantamentos)} tom="ok" />
        <Indicador
          rotulo="Notas + material"
          valor={formatarMoeda(f.notas_a_repassar + f.almoxarifado_cobrado)}
        />
        <Indicador
          rotulo="Saldo devedor"
          valor={formatarMoeda(f.saldo_devedor)}
          tom={f.saldo_devedor > 0 ? 'alerta' : 'ok'}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <Cartao
            titulo="Serviços executados"
            acoes={
              <span className="flex gap-1 text-[11px]">
                <Link
                  href={`/obras/${obraId}/fechamento?agrupar=grupo`}
                  className={agrupamento === 'grupo' ? 'underline font-bold' : 'underline'}
                >
                  por frente
                </Link>
                {locais.length > 0 && (
                  <Link
                    href={`/obras/${obraId}/fechamento?agrupar=local`}
                    className={agrupamento === 'local' ? 'underline font-bold' : 'underline'}
                  >
                    por local
                  </Link>
                )}
              </span>
            }
          >
            {servicos.length === 0 ? (
              <>
                <Vazio>
                  Nenhum serviço lançado no fechamento. Adicione ao lado, ou importe o que já foi
                  medido.
                </Vazio>
                <form action={importarMedicoes} className="mt-2">
                  <input type="hidden" name="obra_id" value={obraId} />
                  <button className="botao botao-neutro" type="submit">
                    Importar serviços das medições
                  </button>
                </form>
              </>
            ) : (
              <div className="rolagem">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Serviço</th>
                      <th className="num">Valor</th>
                      <th className="num">Dedução</th>
                      <th className="num">Líquido</th>
                      <th className="w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.grupos.map((g) => (
                      <GrupoLinhas key={g.grupo} grupo={g} obraId={obraId} />
                    ))}
                    <tr className="total">
                      <td>Total dos serviços</td>
                      <td className="num">{formatarMoeda(f.servicos_bruto)}</td>
                      <td className="num">{formatarMoeda(f.total_deducoes)}</td>
                      <td className="num">{formatarMoeda(f.servicos_liquidos)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Cartao>

          <Cartao titulo="Como o saldo devedor é montado">
            <table className="tabela">
              <tbody>
                <tr>
                  <td>Serviços executados, já com as deduções</td>
                  <td className="num">
                    <Moeda valor={f.servicos_liquidos} />
                  </td>
                </tr>
                <tr>
                  <td>
                    Adiantamentos recebidos
                    {f.total_outro_contrato > 0 && (
                      <div className="text-[11px] text-alerta-700">
                        {formatarMoeda(f.total_outro_contrato)} recebidos pertencem a outro contrato
                        e não entram aqui
                      </div>
                    )}
                  </td>
                  <td className="num">− {formatarMoeda(f.total_adiantamentos)}</td>
                </tr>
                <tr>
                  <td>Notas fiscais a repassar</td>
                  <td className="num">+ {formatarMoeda(f.notas_a_repassar)}</td>
                </tr>
                <tr>
                  <td>Material do almoxarifado cobrado</td>
                  <td className="num">+ {formatarMoeda(f.almoxarifado_cobrado)}</td>
                </tr>
                <tr className="total">
                  <td>Saldo devedor</td>
                  <td className="num">{formatarMoeda(f.saldo_devedor)}</td>
                </tr>
              </tbody>
            </table>
          </Cartao>

          {f.esclarecimentos.length > 0 && (
            <Cartao titulo="Esclarecimentos que saem ao final do relatório">
              <ul className="text-sm space-y-1 list-disc pl-5">
                {f.esclarecimentos.map((e, i) => (
                  <li key={i}>
                    <strong>{e.descricao}</strong> — {formatarMoeda(e.valor)} deduzidos.{' '}
                    {e.justificativa}
                  </li>
                ))}
              </ul>
            </Cartao>
          )}

          {documentos.length > 0 && (
            <Cartao titulo="Documentos já gerados nesta obra">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Referência</th>
                    <th>Gerado em</th>
                  </tr>
                </thead>
                <tbody>
                  {documentos.map((d) => (
                    <tr key={d.id}>
                      <td>{d.tipo}</td>
                      <td>{d.referencia ?? '—'}</td>
                      <td>{new Date(d.gerado_em).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Cartao>
          )}
        </div>

        <div className="space-y-3">
          <Cartao titulo="Gerar o relatório">
            <SeletorVersao
              href={`/obras/${obraId}/fechamento/relatorio`}
              extra={{ agrupar: agrupamento }}
            />
          </Cartao>

          <Cartao titulo={emEdicao ? 'Editar serviço' : 'Adicionar serviço'}>
            <FormularioServicoExecutado
              obraId={obraId}
              servico={emEdicao}
              locais={locais}
              proximaOrdem={servicos.length + 1}
            />
            {emEdicao && (
              <Link href={`/obras/${obraId}/fechamento`} className="botao botao-neutro mt-2 w-full">
                Cancelar edição
              </Link>
            )}
          </Cartao>

          {servicos.length > 0 && (
            <Cartao titulo="Importar das medições">
              <form action={importarMedicoes}>
                <input type="hidden" name="obra_id" value={obraId} />
                <button className="botao botao-neutro w-full" type="submit">
                  Trazer serviços medidos
                </button>
              </form>
              <p className="mt-2 text-[11px] text-slate-500">
                Traz o que já foi medido e ainda não está na lista, com o valor executado.
              </p>
            </Cartao>
          )}
        </div>
      </div>
    </>
  )
}

function GrupoLinhas({
  grupo,
  obraId,
}: {
  grupo: import('@/lib/domain/fechamento-debitos').GrupoServicos
  obraId: string
}) {
  return (
    <>
      <tr className="secao">
        <td colSpan={5}>{grupo.grupo}</td>
      </tr>
      {grupo.servicos.map((s) => (
        <tr key={s.id}>
          <td>
            {s.descricao}
            {!s.executado && <span className="ml-2 etiqueta etiqueta-erro">não executado</span>}
            {s.executado && s.valor_deducao > 0 && (
              <span className="ml-2 etiqueta etiqueta-alerta">parcial</span>
            )}
            {s.justificativa_deducao && (
              <div className="text-[11px] text-slate-500">{s.justificativa_deducao}</div>
            )}
          </td>
          <td className="num">
            <Moeda valor={s.valor} />
          </td>
          <td className="num">{s.deducao_efetiva > 0 ? <Moeda valor={s.deducao_efetiva} /> : '—'}</td>
          <td className="num font-semibold">
            <Moeda valor={s.valor_liquido} />
          </td>
          <td className="whitespace-nowrap text-xs">
            <Link href={`/obras/${obraId}/fechamento?editar=${s.id}`} className="acao acao-neutra">
              editar
            </Link>
            <form action={arquivarServicoExecutado} className="inline">
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="obra_id" value={obraId} />
              <button className="acao acao-perigo" type="submit">
                remover
              </button>
            </form>
          </td>
        </tr>
      ))}
      <tr className="subtotal">
        <td>Subtotal {grupo.grupo}</td>
        <td className="num">{formatarMoeda(grupo.subtotal_bruto)}</td>
        <td className="num">{grupo.deducoes > 0 ? formatarMoeda(grupo.deducoes) : '—'}</td>
        <td className="num">{formatarMoeda(grupo.subtotal)}</td>
        <td></td>
      </tr>
    </>
  )
}
