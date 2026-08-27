import Link from 'next/link'

export const metadata = { title: 'Sem permissão — RV Engenharia' }

export default function PaginaSemPermissao() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="max-w-sm">
        <h1 className="text-lg font-bold">Tela restrita</h1>
        <p className="mt-2 text-sm text-slate-600">
          Valores de contrato, custo, margem, orçamento e resultado da obra são visíveis apenas
          para o perfil administrador.
        </p>
        <Link href="/" className="botao botao-primario mt-4">
          Voltar
        </Link>
      </div>
    </main>
  )
}
