'use server'

import { headers } from 'next/headers'
import { criarClienteServidor } from '@/lib/supabase/server'

export interface EstadoRecuperacao {
  erro?: string
  ok?: string
}

/**
 * Envia o e-mail de recuperacao de senha.
 *
 * Responde a mesma coisa para e-mail cadastrado e nao cadastrado. Dizer
 * "esse e-mail nao existe" entregaria a quem tentar adivinhar quais enderecos
 * tem acesso ao aplicativo.
 */
export async function pedirRecuperacao(
  _estado: EstadoRecuperacao | null,
  form: FormData,
): Promise<EstadoRecuperacao> {
  const email = String(form.get('email') ?? '').trim()
  if (!email) return { erro: 'Informe o seu e-mail.' }

  const cabecalhos = await headers()
  // O endereco do proprio app, seja localhost no computador ou o dominio na
  // Vercel: o link do e-mail tem de voltar para onde a pessoa estava.
  const host = cabecalhos.get('x-forwarded-host') ?? cabecalhos.get('host') ?? ''
  const protocolo = cabecalhos.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const origem = `${protocolo}://${host}`

  const supabase = await criarClienteServidor()
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origem}/auth/confirmar?proximo=/nova-senha`,
  })

  return {
    ok:
      'Se este e-mail estiver cadastrado, o link para criar uma nova senha chega em alguns minutos. ' +
      'Confira a caixa de spam.',
  }
}
