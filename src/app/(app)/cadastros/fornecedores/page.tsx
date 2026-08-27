import { exigirAdmin } from '@/lib/supabase/sessao'
import { criarClienteServidor } from '@/lib/supabase/server'
import { TituloPagina, Cartao, Vazio } from '@/components/ui'
import { FormularioFornecedor } from './formulario'

export default async function PaginaFornecedores() {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('fornecedores')
    .select('id, nome, categoria, contato, condicao_pagamento')
    .is('excluido_em', null)
    .order('nome')

  const fornecedores = data ?? []

  return (
    <>
      <TituloPagina
        titulo="Fornecedores"
        subtitulo="Usados para autocompletar o lançamento de notas fiscais"
      />
      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <Cartao titulo={`Cadastrados (${fornecedores.length})`}>
          {fornecedores.length === 0 ? (
            <Vazio>Nenhum fornecedor cadastrado.</Vazio>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Categoria</th>
                  <th>Contato</th>
                  <th>Condição</th>
                </tr>
              </thead>
              <tbody>
                {fornecedores.map((f) => (
                  <tr key={f.id as string}>
                    <td className="font-semibold">{f.nome as string}</td>
                    <td>{(f.categoria as string) ?? '—'}</td>
                    <td>{(f.contato as string) ?? '—'}</td>
                    <td>{(f.condicao_pagamento as string) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Cartao>
        <Cartao titulo="Novo fornecedor">
          <FormularioFornecedor />
        </Cartao>
      </div>
    </>
  )
}
