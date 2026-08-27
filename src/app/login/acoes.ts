'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'

export async function entrar(_estado: { erro?: string } | null, form: FormData) {
  const email = String(form.get('email') ?? '').trim()
  const senha = String(form.get('senha') ?? '')
  const proximo = String(form.get('proximo') ?? '/')

  if (!email || !senha) return { erro: 'Informe e-mail e senha.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha })

  if (error) return { erro: 'E-mail ou senha incorretos.' }

  revalidatePath('/', 'layout')
  redirect(proximo.startsWith('/') ? proximo : '/')
}

export async function sair() {
  const supabase = await criarClienteServidor()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
