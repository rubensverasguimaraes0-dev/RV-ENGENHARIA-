import { describe, expect, it } from 'vitest'
import { calcularParcelaBalao, resumirCronograma, statusDaParcela, valorEfetivo } from './pagamentos'
import type { Pagamento } from './tipos'

function parcela(id: string, extra: Partial<Pagamento> = {}): Pagamento {
  return {
    id,
    obra_id: 'o1',
    numero_parcela: 1,
    valor_previsto: 0,
    data_prevista: null,
    valor_recebido: null,
    data_recebimento: null,
    forma_pagamento: null,
    comprovante_url: null,
    valor_outro_contrato: 0,
    observacao: null,
    status: 'prevista',
    balao: false,
    ...extra,
  }
}

describe('caso 15 — recebimento que contem valor de outro contrato', () => {
  // Caso real: R$ 4.000,00 recebidos, sendo R$ 1.000,00 saldo do contrato anterior.
  const p = parcela('p1', {
    valor_previsto: 300000,
    valor_recebido: 400000,
    valor_outro_contrato: 100000,
    data_recebimento: '2026-08-10',
    forma_pagamento: 'pix',
    observacao: 'R$ 1.000,00 referentes ao saldo do contrato anterior',
  })

  it('considera apenas R$ 3.000,00 nesta obra', () => {
    expect(valorEfetivo(p)).toBe(300000)
  })

  it('o saldo do contrato desconta so a parte desta obra', () => {
    const r = resumirCronograma([p], 1000000, '2026-08-20')
    expect(r.total_recebido).toBe(400000)
    expect(r.total_recebido_nesta_obra).toBe(300000)
    expect(r.total_outro_contrato).toBe(100000)
    expect(r.saldo_contrato).toBe(700000)
  })

  it('mantem a observacao para sair explicita no relatorio', () => {
    expect(p.observacao).toContain('contrato anterior')
  })
})

describe('parcela balao e alerta de vencimento', () => {
  it('calcula a ultima parcela como o saldo remanescente', () => {
    const parcelas = [
      parcela('p1', { valor_previsto: 300000 }),
      parcela('p2', { valor_previsto: 300000 }),
      parcela('p3', { valor_previsto: 0, balao: true }),
    ]
    expect(calcularParcelaBalao(parcelas, 1096000, 'p3')).toBe(496000)
  })

  it('nunca devolve balao negativo', () => {
    const parcelas = [parcela('p1', { valor_previsto: 1200000 }), parcela('p2', { balao: true })]
    expect(calcularParcelaBalao(parcelas, 1000000, 'p2')).toBe(0)
  })

  it('marca parcela vencida sem recebimento como atrasada', () => {
    expect(statusDaParcela({ valor_recebido: null, data_prevista: '2026-08-01', data_recebimento: null }, '2026-08-20')).toBe('atrasada')
    expect(statusDaParcela({ valor_recebido: null, data_prevista: '2026-09-01', data_recebimento: null }, '2026-08-20')).toBe('prevista')
    expect(statusDaParcela({ valor_recebido: 100, data_prevista: '2026-08-01', data_recebimento: '2026-08-02' }, '2026-08-20')).toBe('paga')
  })

  it('conta as parcelas atrasadas no resumo', () => {
    const r = resumirCronograma(
      [parcela('p1', { valor_previsto: 100000, data_prevista: '2026-07-01' }), parcela('p2', { valor_previsto: 100000, data_prevista: '2026-12-01' })],
      1000000,
      '2026-08-20',
    )
    expect(r.parcelas_atrasadas).toBe(1)
  })
})
