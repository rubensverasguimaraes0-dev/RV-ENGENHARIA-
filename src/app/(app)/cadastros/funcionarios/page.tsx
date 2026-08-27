import Link from 'next/link'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { criarClienteServidor } from '@/lib/supabase/server'
import { TituloPagina, Cartao, Vazio, Etiqueta, Moeda } from '@/components/ui'
import { formatarData } from '@/lib/format'
import { FormularioFuncionario } from './formulario'
import { arquivarFuncionario } from './acoes'
import type { Funcionario } from '@/lib/domain/tipos'

const ROTULO_STATUS = {
  ativo: { texto: 'Ativo', tom: 'ok' as const },
  desligado: { texto: 'Desligado', tom: 'erro' as const },
  alocado: { texto: 'Em outra obra', tom: 'alerta' as const },
}

export default async function PaginaFuncionarios({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>
}) {
  await exigirAdmin()
  const { editar } = await searchParams
  const supabase = await criarClienteServidor()

  const { data } = await supabase
    .from('funcionarios')
    .select(
      'id, nome, tipo, funcao, valor_diaria, telefone, chave_pix, status, data_entrada, data_saida, observacoes',
    )
    .is('excluido_em', null)
    .order('status')
    .order('nome')

  const pessoas = (data ?? []) as (Funcionario & { observacoes: string | null })[]
  const emEdicao = editar ? pessoas.find((f) => f.id === editar) ?? null : null

  return (
    <>
      <TituloPagina
        titulo="Funcionários e parceiros"
        subtitulo="Alterar a diária vale daí para frente — os lançamentos já feitos não mudam"
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <Cartao titulo={`Equipe (${pessoas.length})`}>
          {pessoas.length === 0 ? (
            <Vazio>Nenhum funcionário cadastrado ainda.</Vazio>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Função</th>
                    <th className="num">Diária</th>
                    <th>Chave PIX</th>
                    <th>Situação</th>
                    <th className="w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {pessoas.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <span className="font-semibold">{f.nome}</span>
                        {f.tipo === 'parceiro' && (
                          <span className="ml-2 etiqueta etiqueta-alerta">Parceiro</span>
                        )}
                        {f.data_entrada && (
                          <div className="text-[11px] text-slate-500">
                            desde {formatarData(f.data_entrada)}
                          </div>
                        )}
                      </td>
                      <td>{f.funcao ?? '—'}</td>
                      <td className="num">
                        {f.tipo === 'parceiro' ? (
                          <span className="text-slate-400">participação</span>
                        ) : (
                          <Moeda valor={f.valor_diaria} />
                        )}
                      </td>
                      <td className="text-xs">{f.chave_pix ?? '—'}</td>
                      <td>
                        <Etiqueta tom={ROTULO_STATUS[f.status].tom}>
                          {ROTULO_STATUS[f.status].texto}
                        </Etiqueta>
                      </td>
                      <td className="whitespace-nowrap">
                        <Link
                          href={`/cadastros/funcionarios?editar=${f.id}`}
                          className="text-rv-700 underline text-xs"
                        >
                          editar
                        </Link>
                        <form action={arquivarFuncionario} className="inline">
                          <input type="hidden" name="id" value={f.id} />
                          <button className="text-erro-700 underline text-xs ml-2" type="submit">
                            arquivar
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <ul className="mt-3 text-xs text-slate-600 space-y-1">
            <li>
              <strong>Desligado</strong> some da lista de lançamento, mas continua nos relatórios
              das semanas em que trabalhou.
            </li>
            <li>
              <strong>Em outra obra</strong> não é desligamento: continua na equipe e apenas não
              tem presença naqueles dias.
            </li>
            <li>
              <strong>Parceiro</strong> aparece na presença, come quentinha, não recebe diária e
              participa do resultado.
            </li>
          </ul>
        </Cartao>

        <Cartao titulo={emEdicao ? 'Editar cadastro' : 'Novo cadastro'}>
          <FormularioFuncionario funcionario={emEdicao} />
          {emEdicao && (
            <Link href="/cadastros/funcionarios" className="botao botao-neutro mt-2 w-full">
              Cancelar edição
            </Link>
          )}
        </Cartao>
      </div>
    </>
  )
}
