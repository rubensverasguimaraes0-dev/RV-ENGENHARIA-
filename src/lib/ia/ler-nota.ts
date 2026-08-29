import 'server-only'

/** A leitura da NOTA FISCAL: instrucao e esquema proprios, transporte comum. */
import {
  lerComFerramenta,
  type AnexoDeLeitura,
  type FerramentaDeLeitura,
} from './claude'

export { leituraConfigurada } from './claude'
export type { AnexoDeLeitura as AnexoDaNota }

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

const FERRAMENTA: FerramentaDeLeitura = {
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
}

/** Le a nota — uma ou mais fotos na MESMA chamada — e devolve o objeto bruto. */
export async function lerNotaComIA(anexos: AnexoDeLeitura[]): Promise<unknown> {
  return lerComFerramenta(anexos, INSTRUCAO, FERRAMENTA)
}
