import 'server-only'

/**
 * O transporte comum das leituras por IA (Claude, da Anthropic).
 *
 * So funciona com a chave ANTHROPIC_API_KEY configurada no ambiente — na
 * Vercel, em Settings > Environment Variables. Sem a chave, os botoes de
 * leitura nem aparecem: o app inteiro funciona normalmente sem ela, e este
 * modulo e o unico que a conhece.
 *
 * A chamada forca a resposta numa ferramenta com esquema fechado: o modelo
 * nao responde texto livre, responde os campos. Mesmo assim TUDO passa por um
 * interpretador no dominio antes de chegar ao formulario — o esquema garante
 * a forma, nao a verdade.
 *
 * O modelo padrao e o Haiku, o mais barato com visao: uma leitura custa
 * centavos. Da para trocar pelo LEITURA_NOTA_MODELO sem mexer em codigo
 * (spec 11.6: valor de referencia nunca fica cravado).
 */

export function leituraConfigurada(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

export interface AnexoDeLeitura {
  bytes: Uint8Array
  tipo: 'image/jpeg' | 'application/pdf'
}

export interface FerramentaDeLeitura {
  name: string
  description: string
  input_schema: object
}

/** Manda os anexos e a instrucao; devolve o objeto BRUTO da ferramenta. */
export async function lerComFerramenta(
  anexos: AnexoDeLeitura[],
  instrucao: string,
  ferramenta: FerramentaDeLeitura,
): Promise<unknown> {
  const chave = process.env.ANTHROPIC_API_KEY
  if (!chave) throw new Error('Leitura automática não configurada.')
  if (anexos.length === 0) throw new Error('Nenhuma foto para ler.')

  const blocos = anexos.slice(0, 4).map((a) => {
    const base64 = Buffer.from(a.bytes).toString('base64')
    return a.tipo === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: a.tipo, data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: a.tipo, data: base64 } }
  })

  const resposta = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': chave,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.LEITURA_NOTA_MODELO ?? 'claude-haiku-4-5',
      max_tokens: 1024,
      tools: [ferramenta],
      tool_choice: { type: 'tool', name: ferramenta.name },
      messages: [{ role: 'user', content: [...blocos, { type: 'text', text: instrucao }] }],
    }),
  })

  if (!resposta.ok) {
    // O corpo do erro da API pode citar a chave ou a conta; para a tela vai
    // so o codigo. O detalhe fica no log do servidor.
    const detalhe = await resposta.text().catch(() => '')
    console.error('leitura por IA falhou', resposta.status, detalhe.slice(0, 500))
    if (resposta.status === 401) throw new Error('A chave da leitura automática foi recusada.')
    if (resposta.status === 429) throw new Error('Muitas leituras seguidas. Espere um instante.')
    throw new Error('A leitura automática falhou. Preencha à mão ou tente de novo.')
  }

  const corpo = (await resposta.json()) as {
    content?: { type: string; input?: unknown }[]
  }
  const uso = corpo.content?.find((c) => c.type === 'tool_use')
  if (!uso) throw new Error('A leitura não devolveu nada aproveitável.')
  return uso.input ?? {}
}
