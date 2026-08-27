import { describe, expect, it } from 'vitest'
import { calcularEconomia, dimensionar, precoDeVenda, projetar25Anos } from './solar'

describe('caso 26 — monofasico, 500 kWh/mes, tarifa R$ 1,00/kWh, modulo 610 Wp', () => {
  const d = dimensionar({
    consumo_mensal: [500],
    tipo_ligacao: 'monofasica',
    potencia_modulo_wp: 610,
    area_modulo_m2: 2.79,
  })

  it('desconta o custo de disponibilidade: 470 kWh a compensar', () => {
    expect(d.custo_disponibilidade).toBe(30)
    expect(d.energia_a_compensar).toBe(470)
  })

  it('chega em torno de 3,7 kWp', () => {
    expect(d.potencia_kwp_necessaria).toBeCloseTo(3.72, 2)
  })

  it('arredonda para cima em 7 modulos', () => {
    expect(d.qtd_modulos).toBe(7)
    expect(d.potencia_instalada_kwp).toBeCloseTo(4.27, 2)
  })

  it('dimensiona inversor, area e geracao', () => {
    expect(d.potencia_inversor_kw).toBeCloseTo(3.416, 3)
    expect(d.area_necessaria_m2).toBeCloseTo(19.53, 2)
    expect(d.geracao_mensal_estimada).toBeCloseTo(539.56, 2)
    expect(d.cobertura_consumo).toBeGreaterThan(1)
    expect(d.aviso).toBeNull()
  })

  it('compensa no maximo a energia a compensar', () => {
    expect(d.energia_compensada).toBe(470)
  })
})

describe('caso 27 — trifasico com 100 kWh/mes', () => {
  const d = dimensionar({
    consumo_mensal: [100],
    tipo_ligacao: 'trifasica',
    potencia_modulo_wp: 610,
    area_modulo_m2: 2.79,
  })

  it('avisa que nao ha energia a compensar', () => {
    expect(d.aviso).toContain('Nao ha energia a compensar')
    expect(d.energia_a_compensar).toBe(0)
    expect(d.qtd_modulos).toBe(0)
  })
})

describe('media dos 12 meses', () => {
  it('usa a media quando o consumo vem mes a mes', () => {
    const consumo = [520, 480, 610, 450, 500, 530, 470, 490, 505, 515, 460, 470]
    const d = dimensionar({
      consumo_mensal: consumo,
      tipo_ligacao: 'bifasica',
      potencia_modulo_wp: 610,
      area_modulo_m2: 2.79,
    })
    const media = consumo.reduce((s, v) => s + v, 0) / 12
    expect(d.consumo_medio_mensal).toBeCloseTo(media, 6)
    expect(d.energia_a_compensar).toBeCloseTo(media - 50, 6)
  })
})

describe('economia, payback e projecao de 25 anos', () => {
  const d = dimensionar({
    consumo_mensal: [500],
    tipo_ligacao: 'monofasica',
    potencia_modulo_wp: 610,
    area_modulo_m2: 2.79,
  })
  const entrada = {
    dimensionamento: d,
    tarifa: 100, // R$ 1,00/kWh
    tarifa_fio_b: 30, // R$ 0,30/kWh
    percentual_fio_b: 0.45,
    investimento_total: 2500000, // R$ 25.000,00
  }

  it('calcula economia bruta, Fio B e economia liquida', () => {
    const e = calcularEconomia(entrada)
    expect(e.economia_bruta_mes).toBe(47000) // 470 kWh x R$ 1,00
    expect(e.fio_b_mes).toBe(6345) // 470 x 0,30 x 45%
    expect(e.economia_liquida_mes).toBe(40655)
    expect(e.economia_ano_1).toBe(487860)
  })

  it('calcula o payback', () => {
    const e = calcularEconomia(entrada)
    expect(e.payback_anos).toBeCloseTo(5.12, 2)
  })

  it('projeta 25 anos com degradacao anual', () => {
    const p = projetar25Anos(entrada)
    expect(p).toHaveLength(25)
    expect(p[0]!.economia).toBe(487860)
    expect(p[24]!.economia).toBeLessThan(p[0]!.economia)
    expect(p[24]!.acumulado).toBe(p.reduce((s, a) => s + a.economia, 0))
  })

  it('nao devolve payback quando nao ha economia', () => {
    const semGeracao = dimensionar({
      consumo_mensal: [100],
      tipo_ligacao: 'trifasica',
      potencia_modulo_wp: 610,
      area_modulo_m2: 2.79,
    })
    expect(calcularEconomia({ ...entrada, dimensionamento: semGeracao }).payback_anos).toBeNull()
  })
})

describe('margem da proposta', () => {
  it('aplica a margem configurada sobre o custo total', () => {
    expect(precoDeVenda(2000000, 0.3)).toBe(2600000)
  })
})
