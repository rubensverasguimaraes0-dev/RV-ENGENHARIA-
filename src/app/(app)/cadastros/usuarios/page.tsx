import { exigirAdmin } from '@/lib/supabase/sessao'
import { criarClienteServidor } from '@/lib/supabase/server'
import { TituloPagina, Cartao, Vazio, Etiqueta } from '@/components/ui'
import { FormularioUsuario, FormularioVinculo } from './formulario'
import { desvincularObra } from './acoes'

export default async function PaginaUsuarios() {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const [{ data: usuariosData }, { data: obrasData }, { data: vinculosData }] = await Promise.all([
    supabase.from('usuarios').select('id, nome, email, perfil, ativo').is('excluido_em', null).order('nome'),
    supabase.from('obras').select('id, nome').is('excluido_em', null).order('nome'),
    supabase.from('usuarios_obras').select('usuario_id, obra_id'),
  ])

  const usuarios = (usuariosData ?? []) as {
    id: string
    nome: string
    email: string
    perfil: 'admin' | 'lancador'
    ativo: boolean
  }[]
  const obras = (obrasData ?? []) as { id: string; nome: string }[]
  const vinculos = (vinculosData ?? []) as { usuario_id: string; obra_id: string }[]
  const nomeObra = new Map(obras.map((o) => [o.id, o.nome]))
  const lancadores = usuarios.filter((u) => u.perfil === 'lancador')

  return (
    <>
      <TituloPagina
        titulo="Usuários"
        subtitulo="O lançador só enxerga as obras a que está vinculado — a regra vale no banco, não só na tela"
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <Cartao titulo={`Usuários (${usuarios.length})`}>
            {usuarios.length === 0 ? (
              <Vazio>Nenhum usuário cadastrado.</Vazio>
            ) : (
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Perfil</th>
                    <th>Obras vinculadas</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => {
                    const meus = vinculos.filter((v) => v.usuario_id === u.id)
                    return (
                      <tr key={u.id}>
                        <td className="font-semibold">{u.nome}</td>
                        <td className="text-xs">{u.email}</td>
                        <td>
                          <Etiqueta tom={u.perfil === 'admin' ? 'ok' : 'neutra'}>
                            {u.perfil === 'admin' ? 'Administrador' : 'Lançador'}
                          </Etiqueta>
                        </td>
                        <td>
                          {u.perfil === 'admin' ? (
                            <span className="text-slate-500 text-xs">todas as obras</span>
                          ) : meus.length === 0 ? (
                            <span className="text-alerta-700 text-xs">nenhuma — não lança nada</span>
                          ) : (
                            <ul className="text-xs space-y-0.5">
                              {meus.map((v) => (
                                <li key={v.obra_id} className="flex items-center gap-2">
                                  <span>{nomeObra.get(v.obra_id) ?? '—'}</span>
                                  <form action={desvincularObra}>
                                    <input type="hidden" name="usuario_id" value={u.id} />
                                    <input type="hidden" name="obra_id" value={v.obra_id} />
                                    <button className="text-erro-700 underline" type="submit">
                                      remover
                                    </button>
                                  </form>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Cartao>

          {lancadores.length > 0 && obras.length > 0 && (
            <Cartao titulo="Vincular lançador a uma obra">
              <FormularioVinculo usuarios={lancadores} obras={obras} />
            </Cartao>
          )}
        </div>

        <Cartao titulo="Novo usuário">
          <FormularioUsuario />
        </Cartao>
      </div>
    </>
  )
}
