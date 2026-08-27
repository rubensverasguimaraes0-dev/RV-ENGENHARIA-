export const metadata = { title: 'Sem conexão — RV Engenharia' }

export default function PaginaOffline() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-lg font-bold">Sem conexão</h1>
        <p className="mt-2 text-sm text-slate-600">
          Os dados da obra ficam na nuvem. Assim que o sinal voltar, recarregue a página.
        </p>
      </div>
    </main>
  )
}
