import 'server-only'

/** A leitura da CONTA DE ENERGIA: instrucao e esquema proprios, transporte comum. */
import {
  lerComFerramenta,
  type AnexoDeLeitura,
  type FerramentaDeLeitura,
} from './claude'

const INSTRUCAO = `Você está lendo a foto de uma conta de energia elétrica brasileira
(Equatorial, Enel, Neoenergia, CEMIG etc.), tirada de celular — pode estar torta ou com sombra.

Extraia SOMENTE o que estiver legível. Campo que não der para ler com segurança: omita.
Nunca invente, nunca estime.

- consumo_kwh_mes: o consumo do mês faturado, em kWh (o número da medição, não o valor em reais).
- historico_kwh: a lista do histórico de consumo (gráfico ou tabela dos últimos meses), um número
  por mês, em kWh, na ordem em que aparecem. Só os meses cujo número estiver legível.
- valor_total: o TOTAL a pagar da conta, em reais.
- tarifa: o preço do kWh impresso na conta, em reais, se houver.
- tipo_ligacao: monofásica, bifásica ou trifásica (aparece como "classificação" ou "tipo de
  fornecimento").
- uc: o número da unidade consumidora (também chamado de conta contrato ou código do cliente).
- cliente_nome: o nome do titular da conta.
- endereco: o endereço da instalação.
- distribuidora: o nome da distribuidora que emitiu.
- mes_referencia: o mês de referência da conta (ex.: AGO/2026).`

const FERRAMENTA: FerramentaDeLeitura = {
  name: 'registrar_leitura_conta',
  description: 'Registra os campos lidos da conta de energia. Omita todo campo ilegível.',
  input_schema: {
    type: 'object',
    properties: {
      consumo_kwh_mes: { type: 'number' },
      historico_kwh: { type: 'array', items: { type: 'number' }, maxItems: 13 },
      valor_total: { type: 'string', description: 'total em reais, ex.: 512,34' },
      tarifa: { type: 'string', description: 'R$ por kWh, ex.: 0,89' },
      tipo_ligacao: { type: 'string', enum: ['monofásica', 'bifásica', 'trifásica'] },
      uc: { type: 'string' },
      cliente_nome: { type: 'string' },
      endereco: { type: 'string' },
      distribuidora: { type: 'string' },
      mes_referencia: { type: 'string' },
    },
  },
}

/** Le a conta — frente e verso na mesma chamada, se houver — e devolve o bruto. */
export async function lerContaComIA(anexos: AnexoDeLeitura[]): Promise<unknown> {
  return lerComFerramenta(anexos, INSTRUCAO, FERRAMENTA)
}
