import Link from 'next/link'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { criarClienteServidor } from '@/lib/supabase/server'
import { listarProjetosSolar } from '@/lib/dados/solar'
import { carregarParametros, texto } from '@/lib/parametros'
import { TituloPagina, Cartao, Vazio, Etiqueta, Moeda, Indicador } from '@/components/ui'
import { formatarDataHora, formatarNumero } from '@/lib/format'
import { FormularioNovoProjeto } from './formulario'
import { arquivarProjetoSolar } from './acoes'

const TOM_STATUS: Record<string, 'neutra' | 'ok' | 'alerta' | 'erro'> = {
  rascunho: 'neutra',
  cotado: 'alerta',
  enviado: 'alerta',
  fechado: 'ok',
  perdido: 'erro',
}

export default async function PaginaSolar() {
  await exigirAdmin()

  const supabase = await criarClienteServidor()
  const [projetos, { data: clientesData }, parametros] = await Promise.all([
    listarProjetosSolar(),
    supabase.from('clientes').select('id, nome').is('excluido_em', null).order('nome'),
    carregarParametros(),
  ])

  const fechados = projetos.filter((p) => p.status === 'fechado')

  return (
    <>
      <TituloPagina
        titulo="Energia Solar"
        subtitulo="Do consumo da conta de energia à proposta pronta"
        acoes={
          <>
            <Link href="/solar/expresso" className="botao botao-primario">
              Proposta expressa
            </Link>
            <Link href="/solar/calculadora" className="botao botao-neutro">
              Calculadora
            </Link>
          </>
        }
      />

      <div className="grid gap-2 sm:grid-cols-3 mb-3">
        <Indicador rotulo="Projetos" valor={String(projetos.length)} />
        <Indicador rotulo="Fechados" valor={String(fechados.length)} tom="ok" />
        <Indicador
          rotulo="Em proposta"
          valor={String(projetos.filter((p) => p.status === 'enviado').length)}
          tom="alerta"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <Cartao titulo={`Projetos (${projetos.length})`}>
          {projetos.length === 0 ? (
            <Vazio acao={{ href: '/solar/expresso', rotulo: 'Proposta expressa' }}>
              Nenhum projeto solar ainda. Pela proposta expressa, a conta do cliente entra e a
              proposta sai pronta numa tela só.
            </Vazio>
          ) : (
            <div className="rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>UC</th>
                    <th>Ligação</th>
                    <th className="num">Sistema</th>
                    <th className="num">Proposta</th>
                    <th>Situação</th>
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {projetos.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/solar/${p.id}`} className="font-semibold text-rv-700 underline">
                          {p.cliente_nome}
                        </Link>
                        <div className="text-[10px] text-slate-500">
                          {formatarDataHora(p.criado_em)}
                        </div>
                      </td>
                      <td className="text-xs">{p.uc ?? '—'}</td>
                      <td className="text-xs">{p.tipo_ligacao}</td>
                      <td className="num">
                        {p.potencia_kwp
                          ? `${formatarNumero(p.potencia_kwp, 2)} kWp`
                          : '—'}
                        {p.qtd_modulos ? (
                          <div className="text-[10px] text-slate-500">{p.qtd_modulos} módulos</div>
                        ) : null}
                      </td>
                      <td className="num">
                        {p.preco_venda ? <Moeda valor={p.preco_venda} /> : '—'}
                      </td>
                      <td>
                        <Etiqueta tom={TOM_STATUS[p.status] ?? 'neutra'}>{p.status}</Etiqueta>
                      </td>
                      <td>
                        <form action={arquivarProjetoSolar}>
                          <input type="hidden" name="id" value={p.id} />
                          <button className="acao acao-perigo" type="submit">
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
        </Cartao>

        <Cartao titulo="Novo projeto">
          {(clientesData ?? []).length === 0 ? (
            <p className="text-sm text-slate-600">
              Cadastre um cliente primeiro em{' '}
              <Link href="/cadastros/clientes" className="acao acao-neutra">
                Cadastros → Clientes
              </Link>
              .
            </p>
          ) : (
            <FormularioNovoProjeto
              clientes={(clientesData ?? []) as { id: string; nome: string }[]}
              concessionariaPadrao={texto(parametros, 'solar_concessionaria_padrao', 'Equatorial Piauí')}
            />
          )}
        </Cartao>
      </div>
    </>
  )
}
