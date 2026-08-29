import 'server-only'

/**
 * Freio de mao das actions pagas: cada leitura custa dinheiro na conta da
 * Anthropic, e uma server action e um endpoint HTTP que da para chamar em
 * loop. O contador vive na memoria da instancia — em serverless isso nao e
 * perfeito (cada instancia conta por si), mas contem o loop obvio. O teto
 * DURO e o credito pre-pago na conta da Anthropic: acabou, parou.
 */
const JANELA_MS = 10 * 60 * 1000
const MAXIMO_NA_JANELA = 15
const leiturasPorUsuario = new Map<string, number[]>()

export function passouDoLimiteDeLeitura(usuarioId: string): boolean {
  const agora = Date.now()
  const recentes = (leiturasPorUsuario.get(usuarioId) ?? []).filter((t) => agora - t < JANELA_MS)
  if (recentes.length >= MAXIMO_NA_JANELA) {
    leiturasPorUsuario.set(usuarioId, recentes)
    return true
  }
  recentes.push(agora)
  leiturasPorUsuario.set(usuarioId, recentes)
  return false
}
