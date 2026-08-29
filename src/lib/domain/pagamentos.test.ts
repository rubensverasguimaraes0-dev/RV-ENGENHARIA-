import { describe, expect, it } from 'vitest'
import {
  agruparPorMes,
  calcularParcelaBalao,
  parcelasParaAnexar,
  resumirCronograma,
  statusDaParcela,
  valorEfetivo,
} from './pagamentos'
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

describe('caso 19 — comprovantes anexados ao final do cronograma', () => {
  const parcelas = [
    { ...parcela('p3'), numero_parcela: 3, comprovante_assinado: 'https://exemplo/c3.jpg' },
    { ...parcela('p1'), numero_parcela: 1, comprovante_assinado: 'https://exemplo/c1.jpg' },
    { ...parcela('p2'), numero_parcela: 2, comprovante_assinado: null },
  ]

  it('anexa uma página por parcela que tem comprovante', () => {
    const anexos = parcelasParaAnexar(parcelas)
    expect(anexos).toHaveLength(2)
  })

  it('não anexa parcela sem comprovante', () => {
    expect(parcelasParaAnexar(parcelas).map((p) => p.numero_parcela)).not.toContain(2)
  })

  it('mantém a ordem das parcelas nos anexos', () => {
    expect(parcelasParaAnexar(parcelas).map((p) => p.numero_parcela)).toEqual([1, 3])
  })

  it('sem comprovante nenhum, não há anexo', () => {
    expect(parcelasParaAnexar([{ ...parcela('p1'), comprovante_assinado: null }])).toEqual([])
  })
})


describe('percentual quitado do contrato', () => {
  const contrato = 6_702_964

  it('e a fracao do contrato ja recebida', () => {
    const r = resumirCronograma(
      [
        parcela('p1', { valor_previsto: 500_000, valor_recebido: 500_000 }),
        parcela('p2', { valor_previsto: 500_000, valor_recebido: 500_000 }),
        parcela('p3', { valor_previsto: 500_000, valor_recebido: 500_000 }),
        parcela('p4', { valor_previsto: 500_000, valor_recebido: 500_000 }),
      ],
      contrato,
      '2026-08-29',
    )
    // R$ 20.000,00 de R$ 67.029,64 = 29,8%
    expect(Math.round(r.percentual_quitado * 1000) / 10).toBe(29.8)
  })

  it('desconta o que pertence a outro contrato antes de calcular', () => {
    const r = resumirCronograma(
      [parcela('p1', { valor_recebido: 500_000, valor_outro_contrato: 250_000 })],
      1_000_000,
      '2026-08-29',
    )
    expect(r.percentual_quitado).toBe(0.25)
  })

  it('obra sem contrato fechado nao vira Infinity na tela', () => {
    const r = resumirCronograma([parcela('p1', { valor_recebido: 500_000 })], 0, '2026-08-29')
    expect(r.percentual_quitado).toBe(0)
  })
})

describe('cronograma agrupado por mes de vencimento', () => {
  const parcelas = [
    parcela('p1', { numero_parcela: 1, data_prevista: '2026-07-23', valor_previsto: 500_000, valor_recebido: 500_000 }),
    parcela('p2', { numero_parcela: 2, data_prevista: '2026-08-01', valor_previsto: 500_000, valor_recebido: 500_000 }),
    parcela('p3', { numero_parcela: 3, data_prevista: '2026-08-08', valor_previsto: 500_000 }),
    parcela('p4', { numero_parcela: 4, data_prevista: null, valor_previsto: 702_964 }),
  ]

  it('junta as parcelas do mesmo mes sob uma faixa so', () => {
    const meses = agruparPorMes(parcelas)
    expect(meses.map((m) => m.rotulo)).toEqual([
      'JULHO/2026',
      'AGOSTO/2026',
      'SEM VENCIMENTO DEFINIDO',
    ])
    expect(meses[1]?.parcelas.map((p) => p.numero_parcela)).toEqual([2, 3])
  })

  it('soma previsto e recebido dentro de cada mes', () => {
    const agosto = agruparPorMes(parcelas)[1]
    expect(agosto?.previsto).toBe(1_000_000)
    expect(agosto?.recebido).toBe(500_000)
  })

  it('a parcela sem vencimento nao some do documento — vai para o fim', () => {
    const meses = agruparPorMes(parcelas)
    expect(meses.at(-1)?.parcelas.map((p) => p.numero_parcela)).toEqual([4])
    const total = meses.reduce((s, m) => s + m.parcelas.length, 0)
    expect(total).toBe(parcelas.length)
  })

  it('a virada do mes nao escorrega de fuso: dia 01 fica no proprio mes', () => {
    const meses = agruparPorMes([
      parcela('x', { data_prevista: '2026-09-01', valor_previsto: 100 }),
    ])
    expect(meses[0]?.rotulo).toBe('SETEMBRO/2026')
  })

  it('cronograma vazio nao gera faixa nenhuma', () => {
    expect(agruparPorMes([])).toEqual([])
  })
})
