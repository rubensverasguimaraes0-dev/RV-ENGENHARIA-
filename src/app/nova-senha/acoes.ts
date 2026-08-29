'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'

export interface EstadoNovaSenha {
  erro?: string
}

/** Minimo do Supabase e 6; 8 e o que a especificacao pede para a RV. */
const MINIMO = 8

export async function trocarSenha(
  _estado: EstadoNovaSenha | null,
  form: FormData,
): Promise<EstadoNovaSenha> {
  const senha = String(form.get('senha') ?? '')
  const confirmacao = String(form.get('confirmacao') ?? '')

  if (senha.length < MINIMO) return { erro: `A senha precisa ter pelo menos ${MINIMO} caracteres.` }
  if (senha !== confirmacao) return { erro: 'As duas senhas digitadas não são iguais.' }

  const supabase = await criarClienteServidor()

  // Sem sessao nao ha o que trocar: o link do e-mail expirou ou ja foi usado.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { erro: 'O link expirou. Peça um novo em "Esqueci minha senha".' }

  const { error } = await supabase.auth.updateUser({ password: senha })
  if (error) {
    return {
      erro:
        error.message === 'New password should be different from the old password.'
          ? 'A senha nova precisa ser diferente da atual.'
          : 'Não foi possível trocar a senha. Tente de novo.',
    }
  }

  revalidatePath('/', 'layout')
  redirect('/?senha=trocada')
}
