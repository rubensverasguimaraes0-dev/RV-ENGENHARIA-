import Link from 'next/link'
import { FormularioLogin } from './formulario'
import { Marca } from '@/components/marca'
import { carregarIdentidade, logoDaEmpresa, texto } from '@/lib/parametros'

export const metadata = { title: 'Entrar — RV Engenharia' }

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>
}) {
  const { proximo } = await searchParams
  const identidade = await carregarIdentidade()
  const nomeDaEmpresa = texto(identidade, 'empresa_nome')

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-rv-900">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Marca
            logoUrl={logoDaEmpresa(identidade)}
            nome={nomeDaEmpresa}
            tamanho="entrada"
          />
          <h1 className="mt-3 text-xl font-bold text-white">{nomeDaEmpresa}</h1>
          <p className="text-rv-100 text-sm">Gestão de obras, solar e locação</p>
        </div>

        <div className="cartao overflow-hidden">
          <div className="cartao-titulo">Entrar</div>
          <div className="p-4">
            <FormularioLogin proximo={proximo ?? '/'} />
            <p className="mt-3 text-center text-sm">
              <Link href="/esqueci-senha" className="acao acao-neutra">
                Esqueci minha senha
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-rv-100">
          Eng. Civil Rubens Veras Guimarães — CREA-PI 35900
        </p>
      </div>
    </main>
  )
}
