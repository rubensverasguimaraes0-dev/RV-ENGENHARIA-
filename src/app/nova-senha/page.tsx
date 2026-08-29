import Link from 'next/link'
import { FormularioNovaSenha } from './formulario'
import { Marca } from '@/components/marca'
import { criarClienteServidor } from '@/lib/supabase/server'
import { carregarIdentidade, logoDaEmpresa, texto } from '@/lib/parametros'

export const metadata = { title: 'Nova senha — RV Engenharia' }

/**
 * Serve a dois caminhos, de proposito:
 *  - quem chegou pelo link do e-mail, com a sessao de recuperacao recem-criada;
 *  - quem ja esta dentro do aplicativo e quer trocar a senha.
 *
 * Sem sessao nenhuma, explica o que houve em vez de mandar para o login: quem
 * cai aqui e justamente quem nao consegue entrar.
 */
export default async function PaginaNovaSenha() {
  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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
          <div className="cartao-titulo">Criar uma nova senha</div>
          <div className="p-4 space-y-3">
            {user ? (
              <>
                <p className="text-sm text-slate-600">
                  Trocando a senha de <strong>{user.email}</strong>.
                </p>
                <FormularioNovaSenha />
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  Este link não vale mais — ele expira depois de um tempo e só pode ser usado uma
                  vez. Peça outro, que chega em alguns minutos.
                </p>
                <Link href="/esqueci-senha" className="botao botao-primario w-full text-center">
                  Pedir um novo link
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
