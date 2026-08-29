import type { ReactNode } from 'react'

/**
 * A mesma informacao em duas formas: tabela no computador, ficha no celular.
 *
 * Uma tabela de nove colunas cabe numa tela larga e nao cabe num celular — ali
 * ela vira rolagem lateral, e a pessoa arrasta para o lado so para achar o
 * numero que interessa. A resposta nao e cortar coluna, e mudar de forma: no
 * celular cada linha vira uma ficha, com o titulo em cima, o numero que
 * importa em destaque e o resto embaixo, em pares.
 *
 * O mesmo conteudo sai nas duas formas. Nada e escondido do celular a nao ser
 * o que a propria coluna marcar como `celular: 'escondido'` — e mesmo esse
 * continua na tabela, para quem abrir no computador.
 */
export interface ColunaFicha<T> {
  rotulo: string
  valor: (item: T) => ReactNode
  /** alinha a direita e usa numeral tabular */
  num?: boolean
  /**
   * O papel da coluna na ficha do celular:
   *  titulo    — cabecalho da ficha (a chave da linha)
   *  destaque  — o numero grande, o que a pessoa veio ver
   *  linha     — par rotulo/valor no corpo (padrao)
   *  escondido — sai da ficha; continua na tabela
   */
  celular?: 'titulo' | 'destaque' | 'linha' | 'escondido'
  /** classe extra na celula da tabela */
  classe?: string
  /** cor do destaque na ficha */
  tom?: (item: T) => 'neutro' | 'ok' | 'alerta' | 'erro'
}

export function TabelaFicha<T>({
  colunas,
  itens,
  chave,
  rodape,
  classeDaLinha,
  vazio,
}: {
  colunas: ColunaFicha<T>[]
  itens: T[]
  chave: (item: T) => string
  /** linha de total, so na tabela — na ficha ela viraria uma ficha falsa */
  rodape?: ReactNode
  classeDaLinha?: (item: T) => string
  vazio?: ReactNode
}) {
  if (itens.length === 0) return <>{vazio ?? null}</>

  const titulo = colunas.find((c) => c.celular === 'titulo') ?? colunas[0]
  const destaque = colunas.find((c) => c.celular === 'destaque')
  const noCorpo = colunas.filter(
    (c) => c !== titulo && c !== destaque && c.celular !== 'escondido',
  )

  const cores = {
    neutro: 'text-rv-900',
    ok: 'text-ok-700',
    alerta: 'text-alerta-700',
    erro: 'text-erro-700',
  }

  return (
    <>
      {/* Computador: a tabela inteira. */}
      <div className="rolagem hidden lg:block">
        <table className="tabela">
          <thead>
            <tr>
              {colunas.map((c) => (
                <th key={c.rotulo} className={`${c.num ? 'num' : ''} ${c.classe ?? ''}`}>
                  {c.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={chave(item)} className={classeDaLinha?.(item) ?? ''}>
                {colunas.map((c) => (
                  <td key={c.rotulo} className={`${c.num ? 'num' : ''} ${c.classe ?? ''}`}>
                    {c.valor(item)}
                  </td>
                ))}
              </tr>
            ))}
            {rodape}
          </tbody>
        </table>
      </div>

      {/* Celular: uma ficha por linha. */}
      <ul className="lg:hidden space-y-1.5">
        {itens.map((item) => (
          <li
            key={chave(item)}
            className={`rounded border border-slate-300 bg-white p-2.5 ${
              classeDaLinha?.(item) ?? ''
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="font-semibold text-rv-900 text-[15px] min-w-0">
                {titulo?.valor(item)}
              </div>
              {destaque && (
                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">
                    {destaque.rotulo}
                  </div>
                  <div
                    className={`text-[17px] font-bold tabular-nums leading-tight ${
                      cores[destaque.tom?.(item) ?? 'neutro']
                    }`}
                  >
                    {destaque.valor(item)}
                  </div>
                </div>
              )}
            </div>

            {noCorpo.length > 0 && (
              /* Uma coluna no celular: em duas, "R$ 2.604,00" quebrava no
                 meio, com o "R$" numa linha e o numero na outra. */
              <dl className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 border-t border-slate-200 pt-1.5">
                {noCorpo.map((c) => (
                  <div key={c.rotulo} className="flex items-baseline justify-between gap-3 text-[13px]">
                    <dt className="text-slate-500 shrink-0">{c.rotulo}</dt>
                    <dd
                      className={`font-medium text-right ${
                        c.num ? 'tabular-nums whitespace-nowrap' : ''
                      }`}
                    >
                      {c.valor(item)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
