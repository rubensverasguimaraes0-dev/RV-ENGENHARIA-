import { redirect } from 'next/navigation'
import { criarClienteServidor } from './server'
import type { PerfilUsuario } from '@/lib/domain/tipos'

export interface UsuarioLogado {
  id: string
  nome: string
  email: string
  perfil: PerfilUsuario
}

/** Usuario da sessao, ou null. */
export async function usuarioAtual(): Promise<UsuarioLogado | null> {
  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('usuarios')
    .select('id, nome, email, perfil')
    .eq('id', user.id)
    .maybeSingle()

  if (!data) return null
  return data as UsuarioLogado
}

/** Exige sessao. Redireciona para o login quando nao ha. */
export async function exigirUsuario(): Promise<UsuarioLogado> {
  const u = await usuarioAtual()
  if (!u) redirect('/login')
  return u
}

/**
 * Exige perfil de administrador. E a barreira de servidor das telas de valor
 * sensivel — custo, margem, BDI e resultado (spec 2.1). O banco tambem recusa,
 * mas a tela nem chega a montar.
 */
export async function exigirAdmin(): Promise<UsuarioLogado> {
  const u = await exigirUsuario()
  if (u.perfil !== 'admin') redirect('/sem-permissao')
  return u
}
