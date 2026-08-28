import { Fragment } from 'react'
import Link from 'next/link'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { listarEquipamentos } from '@/lib/dados/locacao'
import { TituloPagina, Cartao, Vazio, Etiqueta, Moeda } from '@/components/ui'
import { FormularioEquipamento, FormularioImportacaoEquipamentos } from '../formulario'
import { arquivarEquipamento } from '../acoes'

const TOM: Record<string, 'ok' | 'alerta' | 'erro'> = {
  disponivel: 'ok',
  locado: 'alerta',
  manutencao: 'erro',
}

export default async function PaginaEquipamentos({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>
}) {
  await exigirAdmin()
  const { editar } = await searchParams
  const equipamentos = await listarEquipamentos()
  const emEdicao = editar ? equipamentos.find((e) => e.id === editar) ?? null : null

  const porCategoria = new Map<string, typeof equipamentos>()
  for (const e of equipamentos) {
    const c = e.categoria ?? 'outros'
    porCategoria.set(c, [...(porCategoria.get(c) ?? []), e])
  }

  return (
    <>
      <TituloPagina
        titulo="Equipamentos e tabela de preços"
        subtitulo="Valor por diária, semana e mês"
        acoes={
          <Link href="/locacao" className="botao botao-neutro">
            Contratos
          </Link>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <Cartao titulo={`Equipamentos (${equipamentos.length})`}>
          {equipamentos.length === 0 ? (
            <Vazio>Nenhum equipamento cadastrado. Importe a tabela por CSV ao lado.</Vazio>
          ) : (
            <div className="rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Equipamento</th>
                    <th>Patrimônio</th>
                    <th className="num">Estoque</th>
                    <th className="num">Diária</th>
                    <th className="num">Semana</th>
                    <th className="num">Mês</th>
                    <th>Situação</th>
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {[...porCategoria.entries()].map(([categoria, lista]) => (
                    <Fragment key={categoria}>
                      <tr className="secao">
                        <td colSpan={8}>{categoria.toUpperCase()}</td>
                      </tr>
                      {lista.map((e) => (
                        <tr key={e.id}>
                          <td className="font-semibold">{e.descricao}</td>
                          <td className="text-xs">{e.patrimonio ?? '—'}</td>
                          <td className="num">{e.quantidade_estoque}</td>
                          <td className="num">
                            {e.tabela ? <Moeda valor={e.tabela.valor_diaria} /> : '—'}
                          </td>
                          <td className="num">
                            {e.tabela ? <Moeda valor={e.tabela.valor_semana} /> : '—'}
                          </td>
                          <td className="num">
                            {e.tabela ? <Moeda valor={e.tabela.valor_mes} /> : '—'}
                          </td>
                          <td>
                            <Etiqueta tom={TOM[e.status] ?? 'ok'}>{e.status}</Etiqueta>
                          </td>
                          <td className="whitespace-nowrap text-xs">
                            <Link
                              href={`/locacao/equipamentos?editar=${e.id}`}
                              className="acao acao-neutra"
                            >
                              editar
                            </Link>
                            <form action={arquivarEquipamento} className="inline">
                              <input type="hidden" name="id" value={e.id} />
                              <button className="acao acao-perigo" type="submit">
                                remover
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Cartao>

        <div className="space-y-3">
          <Cartao titulo={emEdicao ? 'Editar equipamento' : 'Novo equipamento'}>
            <FormularioEquipamento equipamento={emEdicao} />
            {emEdicao && (
              <Link href="/locacao/equipamentos" className="botao botao-neutro mt-2 w-full">
                Cancelar edição
              </Link>
            )}
          </Cartao>

          <Cartao titulo="Importar tabela por CSV">
            <FormularioImportacaoEquipamentos />
          </Cartao>
        </div>
      </div>
    </>
  )
}
