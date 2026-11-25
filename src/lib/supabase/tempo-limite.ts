/**
 * Banco que nao responde nao pode prender o app.
 *
 * Quando o projeto do Supabase esta pausado (o plano gratuito pausa depois de
 * dias sem uso) ou fora do ar, as chamadas ficam penduradas ate a Vercel cortar
 * a requisicao com "504 MIDDLEWARE_INVOCATION_TIMEOUT" — uma tela em ingles que
 * nao diz o que fazer. Com este fetch, a chamada desiste sozinha e o app mostra
 * a tela /indisponivel, que explica o problema.
 */

/** Middleware: a Vercel corta em ~25 s; desistimos bem antes. */
export const LIMITE_MIDDLEWARE_MS = 8_000

/** Telas e acoes do servidor: folga para relatorio pesado, abaixo do corte da funcao. */
export const LIMITE_SERVIDOR_MS = 15_000

export interface FetchComLimite {
  fetch: typeof fetch
  /** true se alguma chamada estourou o tempo ou nem conseguiu conectar. */
  falhou: () => boolean
  /** Para quem desistiu por fora (prazo total) registrar a falha. */
  marcarFalha: () => void
}

export function fetchComLimite(ms: number): FetchComLimite {
  let falhou = false

  const fetchLimitado: typeof fetch = async (entrada, init) => {
    // A biblioteca do Supabase tenta de novo, com espera crescente, quando a
    // renovacao do login falha — e a sessao de quem ficou dias sem abrir o app
    // esta sempre vencida. Somadas, as tentativas passavam dos 25 s da Vercel e o
    // 504 voltava. Depois da primeira falha, desiste na hora.
    if (falhou) throw new Error('banco sem resposta')
    const limite = AbortSignal.timeout(ms)
    const signal = init?.signal ? AbortSignal.any([init.signal, limite]) : limite
    try {
      return await fetch(entrada, { ...init, signal })
    } catch (erro) {
      // Erro de rede ou tempo esgotado: o banco nao respondeu. Resposta HTTP de
      // erro (401, 500...) nao passa por aqui — essa o Supabase trata sozinho.
      falhou = true
      throw erro
    }
  }

  return {
    fetch: fetchLimitado,
    falhou: () => falhou,
    marcarFalha: () => {
      falhou = true
    },
  }
}
