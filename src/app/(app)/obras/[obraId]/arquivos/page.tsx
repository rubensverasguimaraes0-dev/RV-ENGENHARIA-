import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { listarArquivos } from '@/lib/dados/arquivos'
import { TituloPagina, Cartao, Vazio, Indicador } from '@/components/ui'
import { formatarData } from '@/lib/format'
import { FormularioArquivo } from './formulario'
import { arquivarArquivo, alternarMomento } from './acoes'

export default async function PaginaArquivos({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>
  searchParams: Promise<{ aba?: string }>
}) {
  const { obraId } = await params
  const { aba } = await searchParams
  await exigirAdmin()

  const obra = await carregarObra(obraId)
  if (!obra) notFound()

  const arquivos = await listarArquivos(obraId)
  const documentos = arquivos.filter((a) => !a.galeria)
  const galeria = arquivos.filter((a) => a.galeria)
  const mostrarGaleria = aba === 'galeria'

  const antes = galeria.filter((a) => a.momento === 'antes')
  const depois = galeria.filter((a) => a.momento === 'depois')
  const semMarcacao = galeria.filter((a) => !a.momento)

  return (
    <>
      <TituloPagina
        titulo="Arquivos da obra"
        subtitulo={`${obra.nome} — projetos, contratos e fotos recebidos, separados dos documentos gerados`}
        acoes={
          <Link href={`/obras/${obraId}`} className="botao botao-neutro">
            Voltar à obra
          </Link>
        }
      />

      <div className="grid gap-2 sm:grid-cols-3 mb-3">
        <Indicador rotulo="Documentos recebidos" valor={String(documentos.length)} />
        <Indicador rotulo="Fotos na galeria" valor={String(galeria.length)} />
        <Indicador
          rotulo="Antes e depois"
          valor={`${antes.length} / ${depois.length}`}
          detalhe="marcadas"
        />
      </div>

      <div className="flex gap-1 mb-3 nao-imprimir">
        <Link
          href={`/obras/${obraId}/arquivos`}
          className={`px-3 py-1.5 rounded text-xs font-semibold border ${
            !mostrarGaleria ? 'bg-rv-800 text-white border-rv-800' : 'bg-white text-rv-800 border-slate-300'
          }`}
        >
          Documentos ({documentos.length})
        </Link>
        <Link
          href={`/obras/${obraId}/arquivos?aba=galeria`}
          className={`px-3 py-1.5 rounded text-xs font-semibold border ${
            mostrarGaleria ? 'bg-rv-800 text-white border-rv-800' : 'bg-white text-rv-800 border-slate-300'
          }`}
        >
          Galeria de fotos ({galeria.length})
        </Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {!mostrarGaleria ? (
            <Cartao titulo={`Documentos recebidos (${documentos.length})`}>
              {documentos.length === 0 ? (
                <Vazio>
                  Nenhum arquivo guardado. Projetos, contratos, cartão CNPJ e conta de energia
                  entram aqui.
                </Vazio>
              ) : (
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Descrição</th>
                      <th>Data</th>
                      <th className="w-32"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentos.map((a) => (
                      <tr key={a.id}>
                        <td className="font-semibold">{a.tipo ?? '—'}</td>
                        <td>{a.descricao ?? '—'}</td>
                        <td className="whitespace-nowrap">{a.data ? formatarData(a.data) : '—'}</td>
                        <td className="whitespace-nowrap text-xs">
                          {a.url ? (
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                              className="acao acao-neutra"
                            >
                              abrir
                            </a>
                          ) : (
                            <span className="text-slate-400">indisponível</span>
                          )}
                          <form action={arquivarArquivo} className="inline">
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="obra_id" value={obraId} />
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
            </Cartao>
          ) : (
            <>
              {galeria.length === 0 ? (
                <Cartao titulo="Galeria">
                  <Vazio>
                    Nenhuma foto na galeria. Marque o arquivo como foto da obra ao enviar.
                  </Vazio>
                </Cartao>
              ) : (
                [
                  { titulo: 'Antes', fotos: antes },
                  { titulo: 'Depois', fotos: depois },
                  { titulo: 'Sem marcação', fotos: semMarcacao },
                ]
                  .filter((g) => g.fotos.length > 0)
                  .map((g) => (
                    <Cartao key={g.titulo} titulo={`${g.titulo} (${g.fotos.length})`}>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {g.fotos.map((f) => (
                          <figure key={f.id} className="border border-slate-300 rounded overflow-hidden">
                            {f.url && f.imagem ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={f.url}
                                alt={f.descricao ?? 'foto da obra'}
                                className="w-full h-32 object-cover"
                              />
                            ) : (
                              <div className="w-full h-32 flex items-center justify-center bg-slate-100 text-xs text-slate-500">
                                sem prévia
                              </div>
                            )}
                            <figcaption className="p-1.5 text-[11px]">
                              <div className="truncate">{f.descricao ?? '—'}</div>
                              <div className="text-slate-500">
                                {f.data ? formatarData(f.data) : ''}
                              </div>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {f.url && (
                                  <a
                                    href={f.url}
                                    download
                                    target="_blank"
                                    rel="noreferrer"
                                    className="acao acao-neutra"
                                  >
                                    baixar em alta
                                  </a>
                                )}
                                <form action={alternarMomento} className="inline">
                                  <input type="hidden" name="id" value={f.id} />
                                  <input type="hidden" name="obra_id" value={obraId} />
                                  <input type="hidden" name="momento" value={f.momento ?? ''} />
                                  <button className="acao acao-neutra" type="submit">
                                    {f.momento === 'antes'
                                      ? 'marcar depois'
                                      : f.momento === 'depois'
                                        ? 'tirar marcação'
                                        : 'marcar antes'}
                                  </button>
                                </form>
                                <form action={arquivarArquivo} className="inline">
                                  <input type="hidden" name="id" value={f.id} />
                                  <input type="hidden" name="obra_id" value={obraId} />
                                  <button className="acao acao-perigo" type="submit">
                                    remover
                                  </button>
                                </form>
                              </div>
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    </Cartao>
                  ))
              )}
            </>
          )}
        </div>

        <Cartao titulo="Guardar arquivo">
          <FormularioArquivo obraId={obraId} clienteId={obra.cliente_id} />
          <p className="mt-2 text-[11px] text-slate-500">
            Os arquivos ficam em bucket privado, acessível apenas por quem tem a obra liberada.
          </p>
        </Cartao>
      </div>
    </>
  )
}
