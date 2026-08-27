import { FormularioLogin } from './formulario'

export const metadata = { title: 'Entrar — RV Engenharia' }

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>
}) {
  const { proximo } = await searchParams

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-rv-900">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-xl bg-white text-rv-800 text-2xl font-black">
            RV
          </div>
          <h1 className="mt-3 text-xl font-bold text-white">RV Engenharia</h1>
          <p className="text-rv-100 text-sm">Gestão de obras, solar e locação</p>
        </div>

        <div className="cartao overflow-hidden">
          <div className="cartao-titulo">Entrar</div>
          <div className="p-4">
            <FormularioLogin proximo={proximo ?? '/'} />
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-rv-100">
          Eng. Civil Rubens Veras Guimarães — CREA-PI 35900
        </p>
      </div>
    </main>
  )
}
