import { exigirAdmin } from '@/lib/supabase/sessao'
import { criarClienteServidor } from '@/lib/supabase/server'
import { TituloPagina, Cartao, Vazio, Moeda } from '@/components/ui'
import { formatarData } from '@/lib/format'
import { FormularioImportacao } from './formulario'
import { limparBase } from './acoes'

export default async function PaginaPrecosReferencia({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await exigirAdmin()
  const { q } = await searchParams
  const supabase = await criarClienteServidor()

  let consulta = supabase
    .from('precos_referencia')
    .select('id, base, codigo, descricao, unidade, preco_unitario, data_base, uf')
    .is('excluido_em', null)
    .order('base')
    .order('codigo')
    .limit(60)

  if (q?.trim()) consulta = consulta.or(`descricao.ilike.%${q.trim()}%,codigo.ilike.%${q.trim()}%`)

  const [{ data }, { data: contagem }] = await Promise.all([
    consulta,
    supabase.from('precos_referencia').select('base').is('excluido_em', null).limit(50000),
  ])

  const precos = (data ?? []) as {
    id: string
    base: string
    codigo: string
    descricao: string
    unidade: string | null
    preco_unitario: number
    data_base: string | null
    uf: string | null
  }[]

  const porBase = new Map<string, number>()
  for (const p of contagem ?? []) {
    porBase.set(p.base as string, (porBase.get(p.base as string) ?? 0) + 1)
  }

  return (
    <>
      <TituloPagina
        titulo="Preços referenciais"
        subtitulo="SINAPI, ORSE e SICRO — base para o orçamento executivo"
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <Cartao titulo="Bases carregadas">
            {porBase.size === 0 ? (
              <Vazio>Nenhuma tabela importada ainda.</Vazio>
            ) : (
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Base</th>
                    <th className="num">Composições</th>
                    <th className="w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {[...porBase.entries()].map(([base, n]) => (
                    <tr key={base}>
                      <td className="font-semibold">{base}</td>
                      <td className="num">{n}</td>
                      <td>
                        <form action={limparBase}>
                          <input type="hidden" name="base" value={base} />
                          <button className="text-erro-700 underline text-xs" type="submit">
                            limpar base
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Cartao>

          <Cartao titulo="Consultar composições">
            <form method="get" className="flex gap-2 mb-3">
              <input
                className="campo"
                name="q"
                defaultValue={q ?? ''}
                placeholder="Buscar por descrição ou código"
              />
              <button className="botao botao-primario" type="submit">
                Buscar
              </button>
            </form>

            {precos.length === 0 ? (
              <Vazio>Nada encontrado.</Vazio>
            ) : (
              <div className="overflow-x-auto">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Base</th>
                      <th>Código</th>
                      <th>Descrição</th>
                      <th>Un.</th>
                      <th className="num">Preço</th>
                      <th>Data-base</th>
                    </tr>
                  </thead>
                  <tbody>
                    {precos.map((p) => (
                      <tr key={p.id}>
                        <td>{p.base}</td>
                        <td className="text-xs">{p.codigo}</td>
                        <td>{p.descricao}</td>
                        <td>{p.unidade ?? '—'}</td>
                        <td className="num">
                          <Moeda valor={p.preco_unitario} />
                        </td>
                        <td className="text-xs">
                          {p.data_base ? formatarData(p.data_base) : '—'}
                          {p.uf ? ` · ${p.uf}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] text-slate-500">
                  Mostrando até 60 linhas. Use a busca para encontrar a composição.
                </p>
              </div>
            )}
          </Cartao>
        </div>

        <Cartao titulo="Importar tabela">
          <FormularioImportacao />
        </Cartao>
      </div>
    </>
  )
}
