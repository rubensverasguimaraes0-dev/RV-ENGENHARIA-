import Link from 'next/link'
import { exigirUsuario } from '@/lib/supabase/sessao'
import { sair } from '@/app/login/acoes'
import { NavegacaoPrincipal } from '@/components/navegacao'
import { ProvedorDeAvisos } from '@/components/avisos'

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario()

  return (
    <ProvedorDeAvisos>
    <div className="min-h-screen flex flex-col">
      <header className="bg-rv-900 text-white nao-imprimir">
        <div className="mx-auto max-w-6xl px-3 h-14 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 font-bold">
            {/* Monograma do topo: fundo branco cheio contra o azul escuro da
                barra, e o texto no azul mais fechado da paleta — e o par de
                maior contraste que a identidade permite. */}
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white text-rv-900 text-base font-black tracking-tight shadow-sm">
              RV
            </span>
            <span className="hidden sm:inline text-[15px]">RV Engenharia</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline text-rv-100">
              {usuario.nome}
              <span className="ml-2 etiqueta etiqueta-neutra align-middle">
                {usuario.perfil === 'admin' ? 'Administrador' : 'Lançador'}
              </span>
            </span>
            <form action={sair}>
              <button className="text-rv-100 underline underline-offset-2" type="submit">
                Sair
              </button>
            </form>
          </div>
        </div>
        <NavegacaoPrincipal perfil={usuario.perfil} />
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl p-3">{children}</main>

      <footer className="nao-imprimir bg-white border-t border-slate-300 py-3 text-center text-[11px] text-slate-500">
        RV Engenharia — Av. Zequinha Freire, 3531, Teresina/PI — (86) 99437-9883 —
        Eng. Civil Rubens Veras Guimarães, CREA-PI 35900
      </footer>
    </div>
    </ProvedorDeAvisos>
  )
}
