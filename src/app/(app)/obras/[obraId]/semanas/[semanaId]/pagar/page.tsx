import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { carregarFechamento } from '@/lib/dados/semana'
import { criarClienteServidor } from '@/lib/supabase/server'
import { conciliarAcerto, dataSugerida, totaisDoAcerto } from '@/lib/domain/pagamento-funcionario'
import type { PagamentoFuncionario } from '@/lib/domain/tipos'
import { TituloPagina, Cartao, Indicador, Etiqueta, Vazio } from '@/components/ui'
import { formatarData, formatarMoeda, hojeISO } from '@/lib/format'
import { FormularioPagamento, BotaoCopiarPix } from './formulario'
import { arquivarPagamentoFuncionario } from './acoes'

export const metadata = { title: 'Pagamento da semana' }

/**
 * O dia de pagamento: a lista de quem tem a receber, com o Pix de cada um e o
 * comprovante anexado ali mesmo.
 *
 * O valor a receber vem do fechamento da semana, nao e digitado. O formulario
 * ja abre com esse valor, e avisa se o que for pago for diferente.
 */
export default async function PagamentoDaSemana({
  params,
}: {
  params: Promise<{ obraId: string; semanaId: string }>
}) {
  const { obraId, semanaId } = await params
  await exigirAdmin()

  const [obra, f] = await Promise.all([carregarObra(obraId), carregarFechamento(obraId, semanaId)])
  if (!obra || !f) notFound()

  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('pagamentos_funcionario')
    .select('id, obra_id, semana_id, funcionario_id, valor, data_pagamento, forma_pagamento, comprovante_url, observacao')
    .eq('semana_id', semanaId)
    .is('excluido_em', null)

  const pagamentos = (data ?? []) as unknown as PagamentoFuncionario[]
  const linhas = conciliarAcerto(
    f.funcionarios.filter((r) => r.liquido > 0),
    pagamentos,
  )
  const totais = totaisDoAcerto(linhas)
  const sugerida = dataSugerida(hojeISO(), f.semana.data_fim)

  return (
    <>
      <TituloPagina
        titulo={`Pagamento da semana ${f.semana.numero}`}
        subtitulo={`${obra.nome} · ${formatarData(f.semana.data_inicio)} a ${formatarData(f.semana.data_fim)}`}
        acoes={
          <>
            <Link
              href={`/obras/${obraId}/semanas/${semanaId}/recibos`}
              className="botao botao-neutro"
            >
              Imprimir recibos
            </Link>
            <Link href={`/obras/${obraId}/semanas/${semanaId}`} className="botao botao-neutro">
              Voltar à semana
            </Link>
          </>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-3">
        <Indicador rotulo="A pagar na semana" valor={formatarMoeda(totais.a_receber)} />
        <Indicador rotulo="Já pago" valor={formatarMoeda(totais.pago)} tom="ok" />
        <Indicador
          rotulo="Ainda falta sair"
          valor={formatarMoeda(totais.falta)}
          tom={totais.falta > 0 ? 'alerta' : 'ok'}
          detalhe={totais.quantos_faltam > 0 ? `${totais.quantos_faltam} pessoa(s)` : 'ninguém'}
        />
        <Indicador
          rotulo="Comprovantes"
          valor={`${totais.com_comprovante} de ${linhas.length}`}
          tom={totais.com_comprovante === linhas.length && linhas.length > 0 ? 'ok' : 'neutro'}
        />
      </div>

      {linhas.length === 0 ? (
        <Cartao titulo="Nada a pagar">
          <Vazio>
            Nenhum funcionário com diária a receber nesta semana. Lance as presenças primeiro.
          </Vazio>
        </Cartao>
      ) : (
        <div className="space-y-2">
          {linhas.map((l) => (
            <Cartao key={l.funcionario_id} titulo={l.nome}>
              <div className="grid gap-3 lg:grid-cols-[1fr_auto] items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm text-slate-600">{l.funcao}</span>
                    {l.situacao === 'pago' && <Etiqueta tom="ok">pago</Etiqueta>}
                    {l.situacao === 'parcial' && <Etiqueta tom="alerta">pago em parte</Etiqueta>}
                    {l.situacao === 'a_pagar' && <Etiqueta tom="neutra">a pagar</Etiqueta>}
                    {l.situacao === 'a_maior' && <Etiqueta tom="erro">pago a mais</Etiqueta>}
                  </div>

                  <div className="text-sm">
                    A semana apurou <strong>{formatarMoeda(l.a_receber)}</strong>
                    {l.pago > 0 && <> · já pago {formatarMoeda(l.pago)}</>}
                    {l.falta > 0 && (
                      <>
                        {' '}
                        · <span className="text-alerta-700 font-semibold">
                          falta {formatarMoeda(l.falta)}
                        </span>
                      </>
                    )}
                    {l.falta < 0 && (
                      <>
                        {' '}
                        · <span className="text-erro-700 font-semibold">
                          {formatarMoeda(-l.falta)} a mais
                        </span>
                      </>
                    )}
                  </div>

                  {l.chave_pix ? (
                    <div className="mt-1 text-[13px] text-slate-600 flex flex-wrap items-center gap-2">
                      <span className="font-mono break-all">{l.chave_pix}</span>
                      <BotaoCopiarPix chave={l.chave_pix} />
                    </div>
                  ) : (
                    <div className="mt-1 text-[13px] text-slate-500">
                      Sem chave Pix no cadastro.{' '}
                      <Link href="/cadastros/funcionarios" className="acao acao-neutra">
                        cadastrar
                      </Link>
                    </div>
                  )}

                  {l.pagamentos.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {l.pagamentos.map((p) => (
                        <li
                          key={p.id}
                          className="text-[13px] flex flex-wrap items-center gap-2 border-t border-slate-200 pt-1"
                        >
                          <span className="tabular-nums font-medium">{formatarMoeda(p.valor)}</span>
                          <span className="text-slate-600">
                            em {formatarData(p.data_pagamento)}
                            {p.forma_pagamento && ` · ${p.forma_pagamento}`}
                          </span>
                          {p.comprovante_url ? (
                            <Etiqueta tom="ok">com comprovante</Etiqueta>
                          ) : (
                            <Etiqueta tom="alerta">sem comprovante</Etiqueta>
                          )}
                          {p.observacao && (
                            <span className="text-slate-500 basis-full">{p.observacao}</span>
                          )}
                          <form action={arquivarPagamentoFuncionario} className="ml-auto">
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="obra_id" value={obraId} />
                            <input type="hidden" name="semana_id" value={semanaId} />
                            <button className="acao text-erro-700" type="submit">
                              desfazer
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="lg:w-[420px]">
                  <FormularioPagamento
                    obraId={obraId}
                    semanaId={semanaId}
                    funcionarioId={l.funcionario_id}
                    nome={l.nome}
                    falta={l.falta}
                    dataSugerida={sugerida}
                  />
                </div>
              </div>
            </Cartao>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] text-slate-500">
        O valor de cada um vem do fechamento da semana e não é digitado — se o que for pago for
        diferente, o aplicativo avisa antes de salvar. Pagamento desfeito não some do banco: fica
        arquivado, porque é justamente onde o funcionário pode cobrar o que recebeu.
      </p>
    </>
  )
}
