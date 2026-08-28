import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseConfigurado } from '@/lib/supabase/config'

/** Renova a sessao do Supabase a cada navegacao e protege as rotas do app. */
export async function middleware(request: NextRequest) {
  // App ainda sem Supabase: manda para a tela de configuracao em vez de quebrar.
  if (!supabaseConfigurado()) {
    if (request.nextUrl.pathname === '/configurar') return NextResponse.next({ request })
    const url = request.nextUrl.clone()
    url.pathname = '/configurar'
    url.search = ''
    return NextResponse.redirect(url)
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const rotaPublica = pathname === '/login' || pathname === '/offline' || pathname === '/configurar'

  if (!user && !rotaPublica) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('proximo', pathname)
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // A logo entra na tela de login, que e vista sem sessao: se o middleware
  // rodar sobre ela, o proprio arquivo e redirecionado para /login e a imagem
  // quebra justamente na tela onde ela mais aparece.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|logo-rv|manifest.webmanifest|sw.js).*)',
  ],
}
