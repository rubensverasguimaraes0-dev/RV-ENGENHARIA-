/**
 * O que a leitura da CONTA DE ENERGIA devolve, depois de conferida.
 *
 * A conta e mais padronizada que nota fiscal: traz o consumo do mes, o
 * historico dos ultimos 12 ou 13 meses, o tipo de ligacao, a unidade
 * consumidora e o total. E exatamente o que o fluxo expresso do solar pede
 * digitado — entao a leitura preenche e a pessoa confere.
 *
 * Duas contas que ficam AQUI, e nao na IA:
 *  - o consumo medio sai da media do historico (so dos meses plausiveis);
 *  - a tarifa efetiva sai de total ÷ consumo do mes — que e a tarifa COM
 *    impostos, a que o formulario pede. A tarifa impressa na conta e sem
 *    parte dos tributos e faria a economia parecer menor do que e.
 */
import type { Centavos } from '@/lib/format'
import { dinheiroDaLeitura, numeroDaLeitura, textoDaLeitura } from './leitura-comum'
import type { TipoLigacao } from './solar'

export interface LeituraConta {
  cliente_nome: string | null
  endereco: string | null
  uc: string | null
  distribuidora: string | null
  tipo_ligacao: TipoLigacao | null
  /** kWh do mes da conta */
  consumo_mes_kwh: number | null
  /** media do historico; cai para o mes quando o historico nao presta */
  consumo_medio_kwh: number | null
  /** R$/kWh efetivo (total ÷ kWh), em centavos */
  tarifa: Centavos | null
  valor_conta: Centavos | null
  mes_referencia: string | null
  /** aviso quando o total parece carregar coisa que o solar nao abate */
  ressalva: string | null
}

// Consumo residencial/comercial plausivel. Fora disso e leitura errada:
// 3 kWh e relogio parado, 80.000 kWh e industria — nenhum dos dois e conta
// que chega no balcao do fluxo expresso.
const KWH_MINIMO = 10
const KWH_MAXIMO = 50_000

// Tarifa efetiva plausivel no Brasil: R$ 0,30 a R$ 4,00 por kWh. Fora disso,
// ou o total ou o consumo foi lido errado — melhor campo vazio que conta errada.
const TARIFA_MINIMA = 30
const TARIFA_MAXIMA = 400

// A tarifa impressa sai sem ICMS e sem PIS/COFINS; com eles por dentro, o
// fator e ~1/(1-0,30) = 1,43. Deixando 1,5 de folga, o que passar disso nao e
// tributo: e COSIP, multa por atraso ou parcela de acordo — coisa que gerar
// energia nao abate. Dividir um total desses pelo consumo inflaria a economia
// prometida na proposta.
const FATOR_MAXIMO_SOBRE_IMPRESSA = 1.5

function kwh(v: unknown): number | null {
  const n = numeroDaLeitura(v)
  if (n === null || n < KWH_MINIMO || n > KWH_MAXIMO) return null
  return n
}

function ligacao(v: unknown): TipoLigacao | null {
  if (typeof v !== 'string') return null
  const s = v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  if (s.startsWith('mono')) return 'monofasica'
  if (s.startsWith('bi')) return 'bifasica'
  if (s.startsWith('tri')) return 'trifasica'
  return null
}

export function interpretarLeituraConta(bruto: unknown): LeituraConta {
  const b = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>

  const consumo_mes_kwh = kwh(b.consumo_kwh_mes)

  // Historico: so os meses que passam na regua entram na media. Um "0" de mes
  // sem leitura, somado cegamente, derrubaria a media e o sistema sairia
  // subdimensionado.
  const historico = Array.isArray(b.historico_kwh)
    ? b.historico_kwh.map(kwh).filter((n): n is number => n !== null)
    : []
  const consumo_medio_kwh =
    historico.length >= 3
      ? Math.round(historico.reduce((s, n) => s + n, 0) / historico.length)
      : consumo_mes_kwh !== null
        ? Math.round(consumo_mes_kwh)
        : null

  const valor_conta = dinheiroDaLeitura(b.valor_total)

  const impressaBruta = dinheiroDaLeitura(b.tarifa)
  const impressa =
    impressaBruta !== null && impressaBruta >= TARIFA_MINIMA && impressaBruta <= TARIFA_MAXIMA
      ? impressaBruta
      : null

  // Tarifa efetiva: total ÷ kWh do mes. So entra se cair no plausivel.
  let tarifa: Centavos | null = null
  let ressalva: string | null = null

  if (valor_conta !== null && consumo_mes_kwh !== null && consumo_mes_kwh > 0) {
    const efetiva = Math.round(valor_conta / consumo_mes_kwh)
    if (efetiva >= TARIFA_MINIMA && efetiva <= TARIFA_MAXIMA) {
      // Efetiva muito acima da impressa: o total tem COSIP, multa ou parcela
      // de acordo dentro. Nada disso some com o solar, entao usar a efetiva
      // faria a proposta prometer uma economia que nao existe.
      if (impressa !== null && efetiva > Math.round(impressa * FATOR_MAXIMO_SOBRE_IMPRESSA)) {
        tarifa = impressa
        ressalva =
          'O total da conta está bem acima do consumo × tarifa impressa — costuma ser ' +
          'iluminação pública, multa ou parcelamento, que o solar não abate. Usei a tarifa ' +
          'impressa; confira na conta.'
      } else {
        tarifa = efetiva
      }
    }
  }
  if (tarifa === null && impressa !== null) {
    // Sem total legivel, vale a tarifa impressa — melhor que campo vazio,
    // e a pessoa confere do lado da conta.
    tarifa = impressa
  }

  return {
    cliente_nome: textoDaLeitura(b.cliente_nome),
    endereco: textoDaLeitura(b.endereco),
    uc: textoDaLeitura(b.uc),
    distribuidora: textoDaLeitura(b.distribuidora),
    tipo_ligacao: ligacao(b.tipo_ligacao),
    consumo_mes_kwh,
    consumo_medio_kwh,
    tarifa,
    valor_conta,
    mes_referencia: textoDaLeitura(b.mes_referencia),
    ressalva,
  }
}

/** Resumo do que foi lido, para a pessoa ver antes de conferir. */
export function resumoDaLeituraConta(l: LeituraConta): string {
  const lidos = [
    l.consumo_medio_kwh !== null && 'consumo médio',
    l.tarifa !== null && 'tarifa',
    l.tipo_ligacao && 'ligação',
    l.uc && 'unidade consumidora',
    l.cliente_nome && 'nome do cliente',
  ].filter(Boolean)
  if (lidos.length === 0) return 'Não deu para ler nada com segurança nesta conta.'
  const base = `Lidos da conta: ${lidos.join(', ')}. Confira com a conta na mão antes de gerar a proposta.`
  return l.ressalva ? `${base} ${l.ressalva}` : base
}
