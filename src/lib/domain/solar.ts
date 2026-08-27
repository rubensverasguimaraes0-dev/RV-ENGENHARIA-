/**
 * Dimensionamento fotovoltaico e economia (spec 5.3, 5.4 e 5.5).
 * Todos os parametros tem padrao configuravel em Parametros — nada fixo aqui.
 */
import type { Centavos } from '@/lib/format'
import { aplicarFator } from '@/lib/format'

export type TipoLigacao = 'monofasica' | 'bifasica' | 'trifasica'

export interface ParametrosSolar {
  /** kWh/m2.dia — Teresina: 5,4 */
  hsp: number
  /** Performance ratio — 0,78 */
  performance_ratio: number
  /** Custo de disponibilidade em kWh por tipo de ligacao */
  custo_disponibilidade: Record<TipoLigacao, number>
  /** Degradacao anual dos modulos — 0,0055 */
  degradacao_anual: number
  /** Fator de dimensionamento do inversor — 0,75 a 1,00 */
  fator_inversor: number
}

export const PARAMETROS_SOLAR_PADRAO: ParametrosSolar = {
  hsp: 5.4,
  performance_ratio: 0.78,
  custo_disponibilidade: { monofasica: 30, bifasica: 50, trifasica: 100 },
  degradacao_anual: 0.0055,
  fator_inversor: 0.8,
}

export interface EntradaDimensionamento {
  /** Consumo dos ultimos 12 meses em kWh, ou apenas a media (1 valor). */
  consumo_mensal: number[]
  tipo_ligacao: TipoLigacao
  /** Potencia do modulo em Wp (ex.: 610) */
  potencia_modulo_wp: number
  /** Area do modulo em m2 (ex.: 2,79) */
  area_modulo_m2: number
  parametros?: Partial<ParametrosSolar>
}

export interface Dimensionamento {
  consumo_medio_mensal: number
  custo_disponibilidade: number
  energia_a_compensar: number
  geracao_diaria_alvo: number
  potencia_kwp_necessaria: number
  qtd_modulos: number
  potencia_instalada_kwp: number
  potencia_inversor_kw: number
  area_necessaria_m2: number
  geracao_mensal_estimada: number
  energia_compensada: number
  /** Fracao do consumo coberta pela geracao (1 = 100%). */
  cobertura_consumo: number
  /** Preenchido quando nao ha energia a compensar (consumo <= custo de disponibilidade). */
  aviso: string | null
}

export function dimensionar(entrada: EntradaDimensionamento): Dimensionamento {
  const p = { ...PARAMETROS_SOLAR_PADRAO, ...entrada.parametros }
  const meses = entrada.consumo_mensal.filter((v) => Number.isFinite(v))
  const consumo_medio_mensal = meses.length
    ? meses.reduce((s, v) => s + v, 0) / meses.length
    : 0

  const custo_disponibilidade = p.custo_disponibilidade[entrada.tipo_ligacao]
  const energia_a_compensar = consumo_medio_mensal - custo_disponibilidade

  if (energia_a_compensar <= 0) {
    return {
      consumo_medio_mensal,
      custo_disponibilidade,
      energia_a_compensar: 0,
      geracao_diaria_alvo: 0,
      potencia_kwp_necessaria: 0,
      qtd_modulos: 0,
      potencia_instalada_kwp: 0,
      potencia_inversor_kw: 0,
      area_necessaria_m2: 0,
      geracao_mensal_estimada: 0,
      energia_compensada: 0,
      cobertura_consumo: 0,
      aviso:
        `Nao ha energia a compensar: o consumo medio (${consumo_medio_mensal.toFixed(0)} kWh) ` +
        `nao supera o custo de disponibilidade da ligacao ${entrada.tipo_ligacao} ` +
        `(${custo_disponibilidade} kWh).`,
    }
  }

  const geracao_diaria_alvo = energia_a_compensar / 30
  const potencia_kwp_necessaria = geracao_diaria_alvo / (p.hsp * p.performance_ratio)
  const qtd_modulos = Math.ceil((potencia_kwp_necessaria * 1000) / entrada.potencia_modulo_wp)
  const potencia_instalada_kwp = (qtd_modulos * entrada.potencia_modulo_wp) / 1000
  const geracao_mensal_estimada = potencia_instalada_kwp * p.hsp * p.performance_ratio * 30
  const energia_compensada = Math.min(geracao_mensal_estimada, energia_a_compensar)

  return {
    consumo_medio_mensal,
    custo_disponibilidade,
    energia_a_compensar,
    geracao_diaria_alvo,
    potencia_kwp_necessaria,
    qtd_modulos,
    potencia_instalada_kwp,
    potencia_inversor_kw: potencia_instalada_kwp * p.fator_inversor,
    area_necessaria_m2: qtd_modulos * entrada.area_modulo_m2,
    geracao_mensal_estimada,
    energia_compensada,
    cobertura_consumo: consumo_medio_mensal > 0 ? geracao_mensal_estimada / consumo_medio_mensal : 0,
    aviso: null,
  }
}

export interface EntradaEconomia {
  dimensionamento: Dimensionamento
  /** Tarifa cheia em centavos por kWh. */
  tarifa: Centavos
  /** Tarifa do Fio B em centavos por kWh. */
  tarifa_fio_b: Centavos
  /** Percentual do Fio B do ano corrente, conforme a Lei 14.300 (ex.: 0,45). */
  percentual_fio_b: number
  investimento_total: Centavos
}

export interface Economia {
  economia_bruta_mes: Centavos
  fio_b_mes: Centavos
  economia_liquida_mes: Centavos
  economia_ano_1: Centavos
  /** null quando nao ha economia (evita payback infinito). */
  payback_anos: number | null
}

export function calcularEconomia(e: EntradaEconomia): Economia {
  const kwh = e.dimensionamento.energia_compensada
  const economia_bruta_mes = Math.round(kwh * e.tarifa)
  const fio_b_mes = Math.round(kwh * e.tarifa_fio_b * e.percentual_fio_b)
  const economia_liquida_mes = economia_bruta_mes - fio_b_mes
  const economia_ano_1 = economia_liquida_mes * 12
  return {
    economia_bruta_mes,
    fio_b_mes,
    economia_liquida_mes,
    economia_ano_1,
    payback_anos: economia_ano_1 > 0 ? e.investimento_total / economia_ano_1 : null,
  }
}

export interface AnoProjetado {
  ano: number
  geracao_kwh: number
  economia: Centavos
  acumulado: Centavos
}

/** Projecao de 25 anos com a degradacao anual dos modulos (spec 5.4). */
export function projetar25Anos(
  e: EntradaEconomia,
  degradacaoAnual = PARAMETROS_SOLAR_PADRAO.degradacao_anual,
  anos = 25,
): AnoProjetado[] {
  const base = calcularEconomia(e)
  const geracaoAno1 = e.dimensionamento.energia_compensada * 12
  const linhas: AnoProjetado[] = []
  let acumulado = 0
  for (let ano = 1; ano <= anos; ano++) {
    const fator = Math.pow(1 - degradacaoAnual, ano - 1)
    const economia = aplicarFator(base.economia_ano_1, fator)
    acumulado += economia
    linhas.push({ ano, geracao_kwh: geracaoAno1 * fator, economia, acumulado })
  }
  return linhas
}

/** Preco de venda a partir do custo e da margem. A margem nunca aparece na proposta. */
export function precoDeVenda(custoTotal: Centavos, margem: number): Centavos {
  return aplicarFator(custoTotal, 1 + margem)
}
