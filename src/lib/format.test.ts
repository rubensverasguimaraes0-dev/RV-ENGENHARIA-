import { describe, expect, it } from 'vitest'
import {
  diasDaSemana,
  diferencaEmDias,
  ehSabado,
  formatarData,
  formatarMoeda,
  formatarNumero,
  formatarPercentual,
  formatarValor,
  hojeISO,
  lerData,
  lerMoeda,
  lerNumero,
  nomeDoDia,
  segundaDaSemana,
  somarDias,
} from './format'

describe('moeda em centavos', () => {
  it('formata em Real com espaco comum', () => {
    expect(formatarMoeda(917460)).toBe('R$ 9.174,60')
    expect(formatarMoeda(0)).toBe('R$ 0,00')
    expect(formatarMoeda(-100000)).toBe('-R$ 1.000,00')
    expect(formatarMoeda(917460)).not.toContain(' ')
  })

  it('formata sem simbolo para coluna de planilha', () => {
    expect(formatarValor(1096000)).toBe('10.960,00')
  })

  it('le valor digitado em pt-BR', () => {
    expect(lerMoeda('1.234,56')).toBe(123456)
    expect(lerMoeda('R$ 22,00')).toBe(2200)
    expect(lerMoeda('180')).toBe(18000)
    expect(lerMoeda(90)).toBe(9000)
    expect(lerMoeda('')).toBeNull()
    expect(lerMoeda('abc')).toBeNull()
  })

  it('le quantidade com virgula', () => {
    expect(lerNumero('101,94')).toBe(101.94)
    expect(lerNumero('18')).toBe(18)
    expect(lerNumero('x')).toBeNull()
  })

  it('formata numero e percentual', () => {
    expect(formatarNumero(101.94)).toBe('101,94')
    expect(formatarPercentual(0.2887)).toBe('28,87%')
  })
})

describe('datas dd/mm/aaaa sem escorregar de fuso', () => {
  it('formata e le', () => {
    expect(formatarData('2026-08-27')).toBe('27/08/2026')
    expect(lerData('27/08/2026')).toBe('2026-08-27')
    expect(lerData('2026-08-27')).toBe('2026-08-27')
    expect(lerData('nada')).toBeNull()
  })

  it('nao perde o dia ao formatar (bug classico de UTC)', () => {
    expect(formatarData('2026-01-01')).toBe('01/01/2026')
    expect(formatarData('2026-12-31')).toBe('31/12/2026')
  })

  it('soma dias atravessando o mes e o ano', () => {
    expect(somarDias('2026-08-31', 1)).toBe('2026-09-01')
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
    expect(diferencaEmDias('2026-08-03', '2026-08-08')).toBe(5)
  })

  it('identifica sabado e nomeia o dia', () => {
    expect(ehSabado('2026-08-08')).toBe(true)
    expect(ehSabado('2026-08-07')).toBe(false)
    expect(nomeDoDia('2026-08-03')).toBe('Segunda')
  })

  it('monta a semana de segunda a sabado', () => {
    expect(segundaDaSemana('2026-08-06')).toBe('2026-08-03')
    expect(segundaDaSemana('2026-08-03')).toBe('2026-08-03')
    // domingo pertence a semana que comeca no dia seguinte
    expect(segundaDaSemana('2026-08-09')).toBe('2026-08-10')
    expect(diasDaSemana('2026-08-03')).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
    ])
  })

  it('hoje sai no formato ISO local', () => {
    expect(hojeISO(new Date(2026, 7, 27, 22, 30))).toBe('2026-08-27')
  })
})
