import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { listarSemanas } from '@/lib/dados/semana'
import { TituloPagina, Cartao, Vazio, Etiqueta } from '@/components/ui'
import { formatarData } from '@/lib/format'
import { reabrirSemana } from './acoes'

export default async function PaginaSemanas({ params }: { params: Promise<{ obraId: string }> }) {
  const { obraId } = await params
  await exigirAdmin()

  const obra = await carregarObra(obraId)
  if (!obra) notFound()

  const semanas = await listarSemanas(obraId)

  return (
    <>
      <TituloPagina
        titulo="Semanas"
        subtitulo={`${obra.nome} — cada semana é um relatório fechado e independente`}
        acoes={
          <Link href={`/obras/${obraId}`} className="botao botao-neutro">
            Voltar à obra
          </Link>
        }
      />

      <Cartao titulo={`Semanas da obra (${semanas.length})`}>
        {semanas.length === 0 ? (
          <Vazio>
            Nenhuma semana ainda. A semana é criada sozinha no primeiro lançamento de presença.
          </Vazio>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Semana</th>
                <th>Período</th>
                <th>Dias sem expediente</th>
                <th>Situação</th>
                <th className="w-40"></th>
              </tr>
            </thead>
            <tbody>
              {semanas.map((s) => (
                <tr key={s.id}>
                  <td className="font-semibold">Semana {s.numero}</td>
                  <td>
                    {formatarData(s.data_inicio)} a {formatarData(s.data_fim)}
                  </td>
                  <td className="text-xs">
                    {s.dias_sem_expediente.length === 0
                      ? '—'
                      : s.dias_sem_expediente.map(formatarData).join(', ')}
                  </td>
                  <td>
                    {s.status === 'fechada' ? (
                      <Etiqueta tom="neutra">Fechada</Etiqueta>
                    ) : (
                      <Etiqueta tom="ok">Aberta</Etiqueta>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    <Link
                      href={`/obras/${obraId}/semanas/${s.id}`}
                      className="acao acao-neutra"
                    >
                      abrir
                    </Link>
                    {s.status === 'fechada' && (
                      <form action={reabrirSemana} className="inline">
                        <input type="hidden" name="semana_id" value={s.id} />
                        <input type="hidden" name="obra_id" value={obraId} />
                        <button className="acao acao-alerta" type="submit">
                          reabrir
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Cartao>
    </>
  )
}
