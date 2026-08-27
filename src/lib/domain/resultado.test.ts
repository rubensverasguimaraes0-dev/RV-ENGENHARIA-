import { describe, expect, it } from 'vitest'
import { calcularResultado } from './resultado'
import { formatarMoeda } from '@/lib/format'

describe('caso 24 — obra de piso: R$ 10.960,00 cobrados, R$ 7.795,89 de custo', () => {
  const base = {
    receita: { contrato: 1096000, medicoes: 0, notas_repassadas: 0, almoxarifado_cobrado: 0 },
    custo: {
      diarias: 350000, // mao de obra R$ 3.500,00
      quentinhas: 0,
      materiais: 354689, // R$ 3.546,89
      despesas_sem_nota: 6000, // metalurgico R$ 60,00
      locacoes: 40900, // R$ 409,00
      entulho: 28000, // conteiner R$ 280,00
      terceiros: 0,
    },
  }

  it('confere o custo realizado de R$ 7.795,89', () => {
    const r = calcularResultado({ ...base, percentualRateioParceiro: 0.5 })
    expect(r.custo_total).toBe(779589)
    expect(formatarMoeda(r.custo_total)).toBe('R$ 7.795,89')
  })

  it('confere o resultado de R$ 3.164,11', () => {
    const r = calcularResultado({ ...base, percentualRateioParceiro: 0.5 })
    expect(r.resultado).toBe(316411)
    expect(formatarMoeda(r.resultado)).toBe('R$ 3.164,11')
  })

  it('mostra a margem sobre a receita', () => {
    const r = calcularResultado({ ...base, percentualRateioParceiro: 0.5 })
    expect(r.margem).toBeCloseTo(0.2887, 4)
  })

  it('rateia 50/50 sobre o resultado no modo padrao', () => {
    const r = calcularResultado({ ...base, percentualRateioParceiro: 0.5 })
    expect(r.base_rateio).toBe('resultado_total')
    expect(r.parte_parceiro).toBe(158206) // R$ 1.582,06
    expect(r.parte_rv).toBe(158205)
    expect(r.parte_parceiro + r.parte_rv).toBe(r.resultado)
  })

  it('separa as duas apuracoes: insumos (exclusiva RV) e mao de obra', () => {
    const r = calcularResultado({ ...base, percentualRateioParceiro: 0.5 })
    expect(r.custo_insumos).toBe(429589)
    expect(r.resultado_insumos).toBe(-429589) // nada foi repassado, a RV bancou
    expect(r.margem_mao_obra).toBe(746000) // R$ 10.960,00 - R$ 3.500,00
  })

  it('no modo margem_mao_obra o parceiro divide so a margem da mao de obra', () => {
    const r = calcularResultado({
      ...base,
      percentualRateioParceiro: 0.5,
      baseRateio: 'margem_mao_obra',
    })
    expect(r.valor_base_rateio).toBe(746000)
    expect(r.parte_parceiro).toBe(373000)
  })
})

describe('regras gerais do resultado', () => {
  it('soma medicoes, notas repassadas e almoxarifado na receita', () => {
    const r = calcularResultado({
      receita: { contrato: 1000000, medicoes: 917460, notas_repassadas: 250000, almoxarifado_cobrado: 50000 },
      custo: { diarias: 0, quentinhas: 0, materiais: 0, despesas_sem_nota: 0, locacoes: 0, entulho: 0, terceiros: 0 },
      percentualRateioParceiro: 0.5,
    })
    expect(r.receita_servico).toBe(1917460)
    expect(r.receita_insumos).toBe(300000)
    expect(r.receita_total).toBe(2217460)
  })

  it('nao rateia prejuizo com o parceiro', () => {
    const r = calcularResultado({
      receita: { contrato: 100000, medicoes: 0, notas_repassadas: 0, almoxarifado_cobrado: 0 },
      custo: { diarias: 200000, quentinhas: 0, materiais: 0, despesas_sem_nota: 0, locacoes: 0, entulho: 0, terceiros: 0 },
      percentualRateioParceiro: 0.5,
    })
    expect(r.resultado).toBe(-100000)
    expect(r.parte_parceiro).toBe(0)
    expect(r.parte_rv).toBe(-100000)
  })

  it('margem zero quando nao ha receita', () => {
    const r = calcularResultado({
      receita: { contrato: 0, medicoes: 0, notas_repassadas: 0, almoxarifado_cobrado: 0 },
      custo: { diarias: 0, quentinhas: 0, materiais: 0, despesas_sem_nota: 0, locacoes: 0, entulho: 0, terceiros: 0 },
      percentualRateioParceiro: 0.5,
    })
    expect(r.margem).toBe(0)
  })
})

describe('caso 23 — medicao de forro', () => {
  // 101,94 m2 a R$ 90,00/m2 = R$ 9.174,60; custo apurado de R$ 66,74/m2 so na tela interna.
  const quantidade = 101.94
  const precoVenda = 9000 // centavos por m2
  const custoUnitario = 6674

  it('confere o valor de venda de R$ 9.174,60', () => {
    const total = Math.round(quantidade * precoVenda)
    expect(total).toBe(917460)
    expect(formatarMoeda(total)).toBe('R$ 9.174,60')
  })

  it('apura o custo interno e a margem da medicao', () => {
    const custo = Math.round(quantidade * custoUnitario)
    expect(formatarMoeda(custo)).toBe('R$ 6.803,48')
    expect(formatarMoeda(917460 - custo)).toBe('R$ 2.371,12')
  })

  it('sanca cobrada a parte: R$ 90,00/m linear x 18,00 m', () => {
    expect(Math.round(18 * 9000)).toBe(162000)
    expect(formatarMoeda(162000)).toBe('R$ 1.620,00')
  })
})
