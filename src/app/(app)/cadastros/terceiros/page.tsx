import { exigirAdmin } from '@/lib/supabase/sessao'
import { criarClienteServidor } from '@/lib/supabase/server'
import { TituloPagina, Cartao, Vazio } from '@/components/ui'
import { FormularioTerceiro } from '../fornecedores/formulario'

export default async function PaginaTerceiros() {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('terceiros')
    .select('id, nome, atividade, contato, forma_cobranca')
    .is('excluido_em', null)
    .order('nome')

  const terceiros = data ?? []

  return (
    <>
      <TituloPagina
        titulo="Terceiros e subempreiteiros"
        subtitulo="Gesseiro, marmoraria, metalúrgica, serralheria, instalador"
      />
      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <Cartao titulo={`Cadastrados (${terceiros.length})`}>
          {terceiros.length === 0 ? (
            <Vazio>Nenhum terceiro cadastrado.</Vazio>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Atividade</th>
                  <th>Contato</th>
                  <th>Cobrança</th>
                </tr>
              </thead>
              <tbody>
                {terceiros.map((t) => (
                  <tr key={t.id as string}>
                    <td className="font-semibold">{t.nome as string}</td>
                    <td>{(t.atividade as string) ?? '—'}</td>
                    <td>{(t.contato as string) ?? '—'}</td>
                    <td>{(t.forma_cobranca as string) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Cartao>
        <Cartao titulo="Novo terceiro">
          <FormularioTerceiro />
        </Cartao>
      </div>
    </>
  )
}
