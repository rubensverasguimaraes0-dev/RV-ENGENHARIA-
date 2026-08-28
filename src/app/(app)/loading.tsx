/**
 * Mostrada enquanto o servidor busca os dados da tela. Sem ela, a navegacao
 * parecia travada em conexao ruim de obra — o toque nao dava retorno nenhum.
 * O desenho imita a forma da pagina que vem a seguir, para a troca nao "pular".
 */
export default function Carregando() {
  return (
    <div aria-busy="true" aria-label="Carregando" className="animate-pulse">
      <div className="h-6 w-52 rounded bg-slate-300/70 mb-2" />
      <div className="h-4 w-72 rounded bg-slate-200 mb-4" />

      <div className="grid gap-2 sm:grid-cols-4 mb-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="border border-slate-200 rounded bg-white px-3 py-3">
            <div className="h-2.5 w-20 rounded bg-slate-200 mb-2" />
            <div className="h-4 w-28 rounded bg-slate-300/70" />
          </div>
        ))}
      </div>

      <div className="cartao overflow-hidden">
        <div className="h-8 bg-rv-800/70" />
        <div className="p-3 space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-5 rounded bg-slate-200" style={{ width: `${95 - i * 9}%` }} />
          ))}
        </div>
      </div>
    </div>
  )
}
