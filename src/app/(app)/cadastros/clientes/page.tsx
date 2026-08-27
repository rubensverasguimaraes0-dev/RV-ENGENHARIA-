import { exigirAdmin } from '@/lib/supabase/sessao'
import { criarClienteServidor } from '@/lib/supabase/server'
import { TituloPagina, Cartao, Vazio, Etiqueta } from '@/components/ui'
import { FormularioCliente } from './formulario'
import { arquivarCliente } from './acoes'
import Link from 'next/link'

interface ClienteRow {
  id: string
  nome: string
  razao_social_comprovante: string | null
  documento: string | null
  telefone: string | null
  email: string | null
  endereco: string | null
  cliente_pai_id: string | null
  observacoes: string | null
}

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>
}) {
  await exigirAdmin()
  const { editar } = await searchParams
  const supabase = await criarClienteServidor()

  const { data } = await supabase
    .from('clientes')
    .select(
      'id, nome, razao_social_comprovante, documento, telefone, email, endereco, cliente_pai_id, observacoes',
    )
    .is('excluido_em', null)
    .order('nome')

  const clientes = (data ?? []) as ClienteRow[]
  const emEdicao = editar ? clientes.find((c) => c.id === editar) ?? null : null
  const nomePorId = new Map(clientes.map((c) => [c.id, c.nome]))

  return (
    <>
      <TituloPagina
        titulo="Clientes"
        subtitulo="Um cliente pode ter várias obras, várias unidades e um pagador diferente do dono do local"
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
        <Cartao titulo={`Cadastrados (${clientes.length})`}>
          {clientes.length === 0 ? (
            <Vazio>Nenhum cliente cadastrado ainda.</Vazio>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Razão social do comprovante</th>
                    <th>CPF/CNPJ</th>
                    <th>Contato</th>
                    <th className="w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="font-semibold">{c.nome}</span>
                        {c.cliente_pai_id && (
                          <div className="text-[11px] text-slate-500">
                            unidade de {nomePorId.get(c.cliente_pai_id) ?? '—'}
                          </div>
                        )}
                      </td>
                      <td>
                        {c.razao_social_comprovante ?? (
                          <span className="text-slate-400">igual ao nome</span>
                        )}
                      </td>
                      <td>{c.documento ?? '—'}</td>
                      <td>
                        {c.telefone ?? '—'}
                        {c.email && <div className="text-[11px] text-slate-500">{c.email}</div>}
                      </td>
                      <td className="whitespace-nowrap">
                        <Link
                          href={`/cadastros/clientes?editar=${c.id}`}
                          className="text-rv-700 underline text-xs"
                        >
                          editar
                        </Link>
                        <form action={arquivarCliente} className="inline">
                          <input type="hidden" name="id" value={c.id} />
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
        </Cartao>

        <Cartao titulo={emEdicao ? 'Editar cliente' : 'Novo cliente'}>
          <FormularioCliente
            cliente={emEdicao}
            possiveisPais={clientes.filter((c) => c.id !== emEdicao?.id && !c.cliente_pai_id)}
          />
          {emEdicao && (
            <Link href="/cadastros/clientes" className="botao botao-neutro mt-2 w-full">
              Cancelar edição
            </Link>
          )}
        </Cartao>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        <Etiqueta tom="alerta">Atenção</Etiqueta> A razão social do comprovante é a que aparece no
        Pix ou na transferência — nem sempre é o nome pelo qual a obra é conhecida.
      </p>
    </>
  )
}
