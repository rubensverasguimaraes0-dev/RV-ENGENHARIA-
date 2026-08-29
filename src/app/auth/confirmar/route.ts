import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { criarClienteServidor } from '@/lib/supabase/server'
import { destinoSeguro } from '@/lib/destino'

/**
 * Ponto de chegada do link enviado por e-mail.
 *
 * O Supabase manda a pessoa para ca de duas formas, conforme a versao do
 * modelo de e-mail do projeto: com `code` (fluxo PKCE) ou com `token_hash` e
 * `type`. As duas sao aceitas — o app nao pode depender de qual modelo esta
 * configurado no painel, porque quem abre o link e o usuario, nao o
 * programador, e um link que nao abre e uma senha perdida.
 *
 * Da certo: cria a sessao e segue para a tela de nova senha.
 * Da errado (link velho ou ja usado): volta para a recuperacao com o aviso.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const tipo = url.searchParams.get('type') as EmailOtpType | null

  const proximo = destinoSeguro(url.searchParams.get('proximo'), '/nova-senha')

  const supabase = await criarClienteServidor()

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && tipo
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo })
      : { error: { message: 'link sem codigo' } }

  if (error) {
    return NextResponse.redirect(new URL('/esqueci-senha?expirado=1', request.url))
  }

  return NextResponse.redirect(new URL(proximo, request.url))
}
