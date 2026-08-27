import { describe, expect, it } from 'vitest'
import {
  subtotaisPorLocal,
  totalDespesasSemNota,
  totalizarNotas,
  validarRateio,
  verificarPendencias,
} from './notas'
import type { DespesaSemNota, NotaFiscal, RateioNota } from './tipos'

function nota(id: string, valor: number, extra: Partial<NotaFiscal> = {}): NotaFiscal {
  return {
    id,
    obra_id: 'o1',
    semana_id: 's1',
    data: '2026-08-05',
    fornecedor_id: 'fo1',
    fornecedor_nome: 'J. Monte',
    numero_nota: '12345',
    categoria: 'material',
    descricao: 'cimento e areia',
    valor,
    forma_pagamento: 'pix',
    pago_por: 'rv',
    conferida: true,
    repassada_em: null,
    anotacao_interna: null,
    a_confirmar: false,
    qtd_fotos: 1,
    ...extra,
  }
}

describe('caso 10 — nota paga pelo cliente na loja', () => {
  const notas = [nota('n1', 30000), nota('n2', 47640, { pago_por: 'cliente' })]
  const t = totalizarNotas(notas)

  it('nao entra no total a repassar', () => {
    expect(t.a_repassar).toBe(30000)
    expect(t.qtd_a_repassar).toBe(1)
  })

  it('aparece em secao separada com total proprio', () => {
    expect(t.pago_pelo_cliente).toBe(47640)
    expect(t.qtd_pago_pelo_cliente).toBe(1)
  })
})

describe('caso 11 — nota sem foto barra o relatorio', () => {
  const { bloqueios } = verificarPendencias([
    nota('n1', 30000),
    nota('n2', 15000, { qtd_fotos: 0, numero_nota: '999' }),
  ])

  it('aponta exatamente qual nota falta', () => {
    expect(bloqueios).toHaveLength(1)
    expect(bloqueios[0]!.nota_id).toBe('n2')
    expect(bloqueios[0]!.problemas).toContain('sem foto anexada')
    expect(bloqueios[0]!.descricao).toContain('NF 999')
  })

  it('tambem barra nota sem valor e sem obra', () => {
    const { bloqueios: b } = verificarPendencias([nota('n3', 0, { obra_id: null })])
    expect(b[0]!.problemas).toEqual(expect.arrayContaining(['sem valor', 'sem obra vinculada']))
  })
})

describe('caso 12 — rateio de uma nota entre dois locais', () => {
  // Caso real da especificacao: nota de R$ 476,40 dividida entre apto 1802 e apto 1301.
  const n = nota('n1', 47640)
  const rateios: RateioNota[] = [
    { id: 'r1', nota_id: 'n1', local_id: 'apto1802', obra_id: 'o1', valor: 30000 },
    { id: 'r2', nota_id: 'n1', local_id: 'apto1301', obra_id: 'o1', valor: 17640 },
  ]

  it('so aceita rateio que fecha com o valor da nota', () => {
    expect(validarRateio(n, rateios).valido).toBe(true)
    const errado = validarRateio(n, [{ valor: 30000 }, { valor: 10000 }])
    expect(errado.valido).toBe(false)
    expect(errado.diferenca).toBe(7640)
  })

  it('gera o subtotal de cada local', () => {
    const s = subtotaisPorLocal([n], rateios)
    expect(s.find((x) => x.local_id === 'apto1802')!.a_repassar).toBe(30000)
    expect(s.find((x) => x.local_id === 'apto1301')!.a_repassar).toBe(17640)
    expect(s.reduce((acc, x) => acc + x.a_repassar, 0)).toBe(47640)
  })

  it('mantem a nota inteira no local padrao quando nao ha rateio', () => {
    const s = subtotaisPorLocal([n], [], new Map([['n1', 'apto1802']]))
    expect(s).toEqual([{ local_id: 'apto1802', a_repassar: 47640, pago_pelo_cliente: 0 }])
  })
})

describe('caso 13 — nota marcada como a confirmar', () => {
  it('avisa antes de gerar o relatorio, sem bloquear', () => {
    const { alertas, bloqueios } = verificarPendencias([nota('n1', 30000, { a_confirmar: true })])
    expect(bloqueios).toHaveLength(0)
    expect(alertas[0]!.problemas).toContain('local a confirmar')
  })
})

describe('caso 14 — despesa sem nota', () => {
  // Caso real: R$ 60,00 pagos ao metalurgico pelos chumbadores.
  const despesas: DespesaSemNota[] = [
    {
      id: 'd1',
      obra_id: 'o1',
      data: '2026-08-06',
      descricao: 'chumbadores',
      categoria: 'material',
      valor: 6000,
      pago_a: 'metalurgico',
      repassar_cliente: false,
    },
  ]

  it('entra no custo da obra e nao no valor a repassar', () => {
    const t = totalDespesasSemNota(despesas)
    expect(t.custo).toBe(6000)
    expect(t.a_repassar).toBe(0)
  })

  it('so entra no repasse com marcacao explicita', () => {
    const t = totalDespesasSemNota([{ ...despesas[0]!, repassar_cliente: true }])
    expect(t.a_repassar).toBe(6000)
  })
})
