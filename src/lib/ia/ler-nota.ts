import 'server-only'

/**
 * A leitura da nota pela IA (Claude, da Anthropic).
 *
 * So funciona com a chave ANTHROPIC_API_KEY configurada no ambiente — na
 * Vercel, em Settings > Environment Variables. Sem a chave, o botao de
 * leitura nem aparece no formulario: o app inteiro funciona normalmente sem
 * ela, e este arquivo e o unico que a conhece.
 *
 * A chamada forca a resposta numa ferramenta com esquema fechado: o modelo
 * nao responde texto livre, responde os campos. Mesmo assim TUDO passa pelo
 * interpretarLeitura antes de chegar ao formulario — o esquema garante a
 * forma, nao a verdade.
 *
 * O modelo padrao e o Haiku, o mais barato com visao: uma nota custa
 * centavos. Da para trocar pelo LEITURA_NOTA_MODELO sem mexer em codigo
 * (spec 11.6: valor de referencia nunca fica cravado).
 */

export function leituraConfigurada(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

const INSTRUCAO = `Você está lendo a foto de uma nota fiscal, cupom fiscal (NFC-e) ou recibo
brasileiro, tirada em obra — pode estar amassada, torta ou com sombra.

Extraia SOMENTE o que estiver legível. Campo que não der para ler com segurança: omita.
Nunca invente e nunca complete pela metade.

- valor: o TOTAL pago (depois de desconto), em reais.
- data: a data de emissão.
- fornecedor: o nome da loja/empresa que emitiu (fantasia ou razão social).
- numero_nota: o número da nota, NFC-e ou cupom.
- descricao: resumo curto do que foi comprado, em até 8 palavras, minúsculas.
- categoria: material (material de construção), locacao (aluguel de equipamento),
  cacamba (caçamba/entulho), terceiro (serviço de outra empresa),
  combustivel, ou outro.
- forma_pagamento: só se estiver impressa na nota.`

const FERRAMENTA = {
  name: 'registrar_leitura',
  description: 'Registra os campos lidos da nota. Omita todo campo ilegível.',
  input_schema: {
    type: 'object',
    properties: {
      fornecedor: { type: 'string' },
      cnpj: { type: 'string' },
      numero_nota: { type: 'string' },
      data: { type: 'string', description: 'aaaa-mm-dd' },
      valor: { type: 'string', description: 'total em reais, ex.: 476,40' },
      categoria: {
        type: 'string',
        enum: ['material', 'locacao', 'cacamba', 'terceiro', 'combustivel', 'outro'],
      },
      descricao: { type: 'string' },
      forma_pagamento: {
        type: 'string',
        enum: ['pix', 'dinheiro', 'cartão', 'transferência', 'boleto', 'prazo'],
      },
    },
  },
} as const

export interface AnexoDaNota {
  bytes: Uint8Array
  tipo: 'image/jpeg' | 'application/pdf'
}

/**
 * Le a nota — uma ou mais fotos na MESMA chamada, porque cupom longo vem em
 * duas e o total so aparece na segunda — e devolve o objeto BRUTO da
 * ferramenta.
 */
export async function lerNotaComIA(anexos: AnexoDaNota[]): Promise<unknown> {
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
      tools: [FERRAMENTA],
      tool_choice: { type: 'tool', name: 'registrar_leitura' },
      messages: [{ role: 'user', content: [...blocos, { type: 'text', text: INSTRUCAO }] }],
    }),
  })

  if (!resposta.ok) {
    // O corpo do erro da API pode citar a chave ou a conta; para a tela vai
    // so o codigo. O detalhe fica no log do servidor.
    const detalhe = await resposta.text().catch(() => '')
    console.error('leitura da nota falhou', resposta.status, detalhe.slice(0, 500))
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
