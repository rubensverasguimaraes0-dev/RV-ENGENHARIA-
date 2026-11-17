import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { fetchComLimite, LIMITE_SERVIDOR_MS } from './tempo-limite'

type CookieParaGravar = { name: string; value: string; options?: CookieOptions }

/** Cliente do Supabase para Server Components, Route Handlers e Server Actions. */
export async function criarClienteServidor() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Banco sem resposta vira erro em segundos, em vez de prender a tela.
      global: { fetch: fetchComLimite(LIMITE_SERVIDOR_MS).fetch },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieParaGravar[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Component nao pode gravar cookie; o middleware ja renova a sessao.
          }
        },
      },
    },
  )
}

/**
 * Cliente com a service role — ignora RLS. Uso restrito a rotas de servidor que
 * precisam administrar usuarios. Nunca importar isto em codigo de cliente.
 */
export function criarClienteAdministrativo() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!chave) throw new Error('SUPABASE_SERVICE_ROLE_KEY nao configurada')

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    cookies: { getAll: () => [] as CookieParaGravar[], setAll: () => {} },
  })
}
