import Link from 'next/link'
import { FormularioRecuperacao } from './formulario'
import { Marca } from '@/components/marca'
import { carregarIdentidade, logoDaEmpresa, texto } from '@/lib/parametros'

export const metadata = { title: 'Recuperar senha — RV Engenharia' }

export default async function PaginaEsqueciSenha() {
  const identidade = await carregarIdentidade()
  const nomeDaEmpresa = texto(identidade, 'empresa_nome')

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-rv-900">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Marca logoUrl={logoDaEmpresa(identidade)} nome={nomeDaEmpresa} tamanho="entrada" />
          <h1 className="mt-3 text-xl font-bold text-white">{nomeDaEmpresa}</h1>
        </div>

        <div className="cartao overflow-hidden">
          <div className="cartao-titulo">Esqueci minha senha</div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-slate-600">
              Informe o e-mail com que você entra no aplicativo. Enviamos um link para você criar
              uma senha nova.
            </p>
            <FormularioRecuperacao />
            <p className="text-center text-sm">
              <Link href="/login" className="acao acao-neutra">
                Voltar para a entrada
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
