export const metadata = { title: 'Banco de dados fora do ar — RV Engenharia' }

/**
 * Para onde o middleware manda quando o Supabase nao responde a tempo. Nao
 * consulta o banco — e justamente ele que esta fora — entao abre sempre.
 */
export default async function PaginaIndisponivel({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>
}) {
  const { proximo } = await searchParams
  // So caminho interno, para o link nao virar redirecionamento para outro site.
  const voltar = proximo && proximo.startsWith('/') && !proximo.startsWith('//') ? proximo : '/'

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-lg font-bold">O banco de dados não está respondendo</h1>
        <p className="mt-3 text-sm text-slate-600">
          O aplicativo está no ar, mas não conseguiu falar com o banco de dados (Supabase). Os dados
          estão guardados — só não estão acessíveis agora.
        </p>

        <div className="mt-5 text-left text-sm text-slate-700 rounded-lg border border-slate-200 p-4">
          <p className="font-semibold">Causa mais comum: o projeto foi pausado</p>
          <p className="mt-1">
            No plano gratuito, o Supabase pausa o projeto depois de alguns dias sem uso. Para
            reativar:
          </p>
          <ol className="mt-2 list-decimal pl-5 space-y-1">
            <li>Entre em supabase.com e abra o projeto.</li>
            <li>
              Se aparecer <strong>Project is paused</strong>, toque em{' '}
              <strong>Restore project</strong>.
            </li>
            <li>Espere de 2 a 5 minutos e tente de novo.</li>
          </ol>
          <p className="mt-2">
            Se o projeto não estiver pausado, pode ser uma instabilidade passageira — aguarde alguns
            minutos.
          </p>
        </div>

        {/* <a> e nao <Link>: precisa passar de novo pelo servidor para testar o banco. */}
        <a href={voltar} className="botao botao-primario mt-5 inline-block">
          Tentar de novo
        </a>
      </div>
    </main>
  )
}
