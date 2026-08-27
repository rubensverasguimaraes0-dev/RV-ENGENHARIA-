import { describe, expect, it } from 'vitest'
import {
  apurarContrato,
  calcularPeriodo,
  saldoDoContrato,
  statusDoContrato,
  type ItemContrato,
  type TabelaPreco,
} from './locacao'
import { formatarMoeda } from '@/lib/format'

// Martelete: R$ 60,00/dia, R$ 300,00/semana, R$ 900,00/mês
const TABELA: TabelaPreco = { valor_diaria: 6000, valor_semana: 30000, valor_mes: 90000 }

function item(extra: Partial<ItemContrato> = {}): ItemContrato {
  return {
    id: 'i1',
    equipamento_id: 'e1',
    descricao: 'Martelete rompedor',
    quantidade: 1,
    tabela: TABELA,
    ...extra,
  }
}

describe('valor do período pela tabela', () => {
  it('cobra por diária no período curto', () => {
    const p = calcularPeriodo(3, TABELA)
    expect(formatarMoeda(p.valor)).toBe('R$ 180,00')
    expect(p.detalhe).toBe('3 diárias')
  })

  it('passa a cobrar por semana quando compensa', () => {
    const p = calcularPeriodo(7, TABELA)
    expect(formatarMoeda(p.valor)).toBe('R$ 300,00')
    expect(p.detalhe).toBe('1 semana')
  })

  it('combina semana e diária', () => {
    // 9 dias: 1 semana + 2 diárias = 300 + 120 = 420
    const p = calcularPeriodo(9, TABELA)
    expect(formatarMoeda(p.valor)).toBe('R$ 420,00')
    expect(p.detalhe).toBe('1 semana + 2 diárias')
  })

  it('nunca cobra mais que o bloco seguinte', () => {
    // 6 dias soltos custariam 360; a semana inteira custa 300
    const p = calcularPeriodo(6, TABELA)
    expect(formatarMoeda(p.valor)).toBe('R$ 300,00')
    expect(p.detalhe).toBe('1 semana')
  })

  it('o 29º dia não custa mais que o 30º', () => {
    const vinteNove = calcularPeriodo(29, TABELA)
    const trinta = calcularPeriodo(30, TABELA)
    expect(vinteNove.valor).toBeLessThanOrEqual(trinta.valor)
    expect(formatarMoeda(trinta.valor)).toBe('R$ 900,00')
  })

  it('cobra o mês cheio quando o período passa dele', () => {
    // 35 dias: 1 mês + 5 diárias = 900 + 300 = 1.200; ou 1 mês + 1 semana = 1.200
    const p = calcularPeriodo(35, TABELA)
    expect(formatarMoeda(p.valor)).toBe('R$ 1.200,00')
  })

  it('cobra ao menos uma diária', () => {
    expect(formatarMoeda(calcularPeriodo(0, TABELA).valor)).toBe('R$ 60,00')
  })

  it('funciona com tabela só de diária', () => {
    const p = calcularPeriodo(10, { valor_diaria: 5000, valor_semana: 0, valor_mes: 0 })
    expect(formatarMoeda(p.valor)).toBe('R$ 500,00')
    expect(p.detalhe).toBe('10 diárias')
  })
})

describe('apuração do contrato', () => {
  it('cobra o previsto quando devolve na data', () => {
    const a = apurarContrato({
      itens: [item()],
      data_saida: '2026-08-03',
      data_prevista: '2026-08-10',
      data_devolucao: '2026-08-10',
      hoje: '2026-08-27',
    })
    expect(a.dias_previstos).toBe(7)
    expect(a.dias_adicionais).toBe(0)
    expect(formatarMoeda(a.valor_total)).toBe('R$ 300,00')
    expect(a.em_atraso).toBe(false)
  })

  it('cobra diárias adicionais quando devolve depois', () => {
    const a = apurarContrato({
      itens: [item()],
      data_saida: '2026-08-03',
      data_prevista: '2026-08-10',
      data_devolucao: '2026-08-13',
      hoje: '2026-08-27',
    })
    expect(a.dias_adicionais).toBe(3)
    expect(formatarMoeda(a.valor_previsto)).toBe('R$ 300,00')
    expect(formatarMoeda(a.valor_adicional)).toBe('R$ 180,00')
    expect(formatarMoeda(a.valor_total)).toBe('R$ 480,00')
  })

  it('multiplica pela quantidade de equipamentos', () => {
    const a = apurarContrato({
      itens: [item({ quantidade: 3 })],
      data_saida: '2026-08-03',
      data_prevista: '2026-08-10',
      data_devolucao: '2026-08-10',
      hoje: '2026-08-27',
    })
    expect(formatarMoeda(a.valor_total)).toBe('R$ 900,00')
  })

  it('soma equipamentos diferentes no mesmo contrato', () => {
    const betoneira: TabelaPreco = { valor_diaria: 8000, valor_semana: 40000, valor_mes: 120000 }
    const a = apurarContrato({
      itens: [item(), item({ id: 'i2', descricao: 'Betoneira', tabela: betoneira })],
      data_saida: '2026-08-03',
      data_prevista: '2026-08-10',
      data_devolucao: '2026-08-10',
      hoje: '2026-08-27',
    })
    expect(formatarMoeda(a.valor_total)).toBe('R$ 700,00') // 300 + 400
    expect(a.itens).toHaveLength(2)
  })

  it('equipamento não devolvido conta até hoje e marca atraso', () => {
    const a = apurarContrato({
      itens: [item()],
      data_saida: '2026-08-03',
      data_prevista: '2026-08-10',
      data_devolucao: null,
      hoje: '2026-08-14',
    })
    expect(a.em_atraso).toBe(true)
    expect(a.dias_efetivos).toBe(11)
    expect(a.dias_adicionais).toBe(4)
    expect(formatarMoeda(a.valor_adicional)).toBe('R$ 240,00')
  })

  it('sem data prevista, cobra o período efetivo', () => {
    const a = apurarContrato({
      itens: [item()],
      data_saida: '2026-08-03',
      data_prevista: null,
      data_devolucao: '2026-08-06',
      hoje: '2026-08-27',
    })
    expect(a.dias_adicionais).toBe(0)
    expect(formatarMoeda(a.valor_total)).toBe('R$ 180,00')
  })
})

describe('status e saldo do contrato', () => {
  const hoje = '2026-08-27'

  it('marca atrasado quando passou a devolução prevista', () => {
    expect(
      statusDoContrato({ data_prevista: '2026-08-20', data_devolucao: null, status: 'aberto' }, hoje),
    ).toBe('atrasado')
  })

  it('marca devolvido quando há data de devolução', () => {
    expect(
      statusDoContrato({ data_prevista: '2026-08-20', data_devolucao: '2026-08-22', status: 'aberto' }, hoje),
    ).toBe('devolvido')
  })

  it('mantém aberto dentro do prazo', () => {
    expect(
      statusDoContrato({ data_prevista: '2026-09-10', data_devolucao: null, status: 'aberto' }, hoje),
    ).toBe('aberto')
  })

  it('cancelado continua cancelado', () => {
    expect(
      statusDoContrato({ data_prevista: '2026-08-01', data_devolucao: null, status: 'cancelado' }, hoje),
    ).toBe('cancelado')
  })

  it('a caução abate o saldo, sem ficar negativo', () => {
    expect(formatarMoeda(saldoDoContrato(48000, 20000))).toBe('R$ 280,00')
    expect(saldoDoContrato(10000, 50000)).toBe(0)
  })
})
