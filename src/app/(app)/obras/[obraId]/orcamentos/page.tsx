import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { listarOrcamentos } from '@/lib/dados/orcamento'
import { TituloPagina, Cartao, Vazio, Etiqueta, Moeda } from '@/components/ui'
import { formatarData, formatarPercentual, hojeISO } from '@/lib/format'
import { FormularioNovoOrcamento } from './formulario'
import { arquivarOrcamento } from './acoes'

export default async function PaginaOrcamentos({ params }: { params: Promise<{ obraId: string }> }) {
  const { obraId } = await params
  await exigirAdmin()

  const obra = await carregarObra(obraId)
  if (!obra) notFound()

  const orcamentos = await listarOrcamentos(obraId)
  const hoje = hojeISO()

  return (
    <>
      <TituloPagina
        titulo="Orçamentos"
        subtitulo={`${obra.nome} — orçamento rápido e orçamento executivo`}
        acoes={
          <Link href={`/obras/${obraId}`} className="botao botao-neutro">
            Voltar à obra
          </Link>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <Cartao titulo={`Orçamentos da obra (${orcamentos.length})`}>
          {orcamentos.length === 0 ? (
            <Vazio>Nenhum orçamento nesta obra.</Vazio>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Tipo</th>
                  <th>Data</th>
                  <th>Validade</th>
                  <th>BDI</th>
                  <th className="num">Total</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {orcamentos.map((o) => {
                  const vencido = o.validade !== null && o.validade < hoje
                  return (
                    <tr key={o.id}>
                      <td>
                        <Link
                          href={`/obras/${obraId}/orcamentos/${o.id}`}
                          className="font-semibold text-rv-700 underline"
                        >
                          {o.titulo ?? 'sem título'}
                        </Link>
                        {o.numero && (
                          <div className="text-[10px] text-slate-500">nº {o.numero}</div>
                        )}
                      </td>
                      <td>{o.tipo === 'completo' ? 'Completo' : 'Rápido'}</td>
                      <td>{formatarData(o.data)}</td>
                      <td>
                        {o.validade ? (
                          <>
                            {formatarData(o.validade)}
                            {vencido && <Etiqueta tom="erro">vencido</Etiqueta>}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {o.bdi > 0 ? formatarPercentual(o.bdi, 0) : '—'}
                        <div className="text-[10px] text-slate-500">
                          {o.modo_bdi === 'embutido'
                            ? 'embutido'
                            : o.modo_bdi === 'visivel'
                              ? 'visível'
                              : 'sem BDI'}
                        </div>
                      </td>
                      <td className="num">
                        <Moeda valor={o.total} />
                      </td>
                      <td>
                        <form action={arquivarOrcamento}>
                          <input type="hidden" name="id" value={o.id} />
                          <input type="hidden" name="obra_id" value={obraId} />
                          <button className="text-erro-700 underline text-xs" type="submit">
                            arquivar
                          </button>
                        </form>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Cartao>

        <Cartao titulo="Novo orçamento">
          <FormularioNovoOrcamento obraId={obraId} />
        </Cartao>
      </div>
    </>
  )
}
