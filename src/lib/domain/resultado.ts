/**
 * Resultado da obra — orcado x realizado (spec 4.15). Tela interna, nunca
 * enviada ao cliente.
 *
 * O rateio com o parceiro e marcado como [CONFIRMAR] na especificacao (item
 * 14.2). Por isso a base do rateio e um parametro da obra e nao uma regra fixa:
 *
 *  - 'resultado_total'  (padrao): o parceiro divide o resultado que sobra
 *    depois de a RV liquidar materiais, locacoes, entulho e terceiros;
 *  - 'margem_mao_obra': o parceiro divide apenas (receita de servico - custo de
 *    mao de obra), ficando o resultado de insumos inteiro com a RV.
 *
 * Em qualquer dos dois modos a tela mostra as duas apuracoes separadas.
 */
import type { Centavos } from '@/lib/format'
import { aplicarFator } from '@/lib/format'

export type BaseRateioParceiro = 'resultado_total' | 'margem_mao_obra'

export interface ReceitaObra {
  /** Contrato e medicoes: o que foi cobrado pelo servico. */
  contrato: Centavos
  medicoes: Centavos
  /** Insumos repassados: notas repassadas ao cliente e almoxarifado cobrado. */
  notas_repassadas: Centavos
  almoxarifado_cobrado: Centavos
}

export interface CustoObra {
  /** Mao de obra: diarias + quentinhas. */
  diarias: Centavos
  quentinhas: Centavos
  /** Insumos e servicos de terceiros — apuracao exclusiva da RV. */
  materiais: Centavos
  despesas_sem_nota: Centavos
  locacoes: Centavos
  entulho: Centavos
  terceiros: Centavos
}

export interface ApuracaoResultado {
  receita_servico: Centavos
  receita_insumos: Centavos
  receita_total: Centavos
  custo_mao_obra: Centavos
  custo_insumos: Centavos
  custo_total: Centavos
  /** receita - custo */
  resultado: Centavos
  /** Fracao do resultado sobre a receita (0.2887 = 28,87%). 0 quando nao ha receita. */
  margem: number
  /** Apuracao de insumos, exclusiva da RV. */
  resultado_insumos: Centavos
  /** Apuracao de mao de obra: receita de servico - diarias - quentinhas. */
  margem_mao_obra: Centavos
  base_rateio: BaseRateioParceiro
  valor_base_rateio: Centavos
  parte_parceiro: Centavos
  parte_rv: Centavos
}

export function calcularResultado(input: {
  receita: ReceitaObra
  custo: CustoObra
  percentualRateioParceiro: number
  baseRateio?: BaseRateioParceiro
}): ApuracaoResultado {
  const { receita, custo, percentualRateioParceiro } = input
  const baseRateio = input.baseRateio ?? 'resultado_total'

  const receita_servico = receita.contrato + receita.medicoes
  const receita_insumos = receita.notas_repassadas + receita.almoxarifado_cobrado
  const receita_total = receita_servico + receita_insumos

  const custo_mao_obra = custo.diarias + custo.quentinhas
  const custo_insumos =
    custo.materiais + custo.despesas_sem_nota + custo.locacoes + custo.entulho + custo.terceiros
  const custo_total = custo_mao_obra + custo_insumos

  const resultado = receita_total - custo_total
  const resultado_insumos = receita_insumos - custo_insumos
  const margem_mao_obra = receita_servico - custo_mao_obra

  const valor_base_rateio = baseRateio === 'margem_mao_obra' ? margem_mao_obra : resultado
  // Prejuizo nao e rateado com o parceiro: a base negativa fica com a RV.
  const parte_parceiro =
    valor_base_rateio > 0 ? aplicarFator(valor_base_rateio, percentualRateioParceiro) : 0

  return {
    receita_servico,
    receita_insumos,
    receita_total,
    custo_mao_obra,
    custo_insumos,
    custo_total,
    resultado,
    margem: receita_total > 0 ? resultado / receita_total : 0,
    resultado_insumos,
    margem_mao_obra,
    base_rateio: baseRateio,
    valor_base_rateio,
    parte_parceiro,
    parte_rv: resultado - parte_parceiro,
  }
}

export interface ComparativoItem {
  descricao: string
  orcado: Centavos
  realizado: Centavos
  diferenca: Centavos
}

/** Comparativo item a item orcado x realizado, quando existe orcamento vinculado. */
export function compararOrcadoRealizado(
  orcado: Map<string, Centavos>,
  realizado: Map<string, Centavos>,
): ComparativoItem[] {
  const chaves = new Set([...orcado.keys(), ...realizado.keys()])
  return [...chaves]
    .map((descricao) => {
      const o = orcado.get(descricao) ?? 0
      const r = realizado.get(descricao) ?? 0
      return { descricao, orcado: o, realizado: r, diferenca: o - r }
    })
    .sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'))
}
