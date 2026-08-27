import { describe, expect, it } from 'vitest'
import {
  agruparPorCategoria,
  calcularSaldos,
  resumirAlmoxarifado,
  subtotaisPorCorBitola,
  type ItemAlmoxarifado,
  type SaidaAlmoxarifado,
} from './almoxarifado'
import { formatarMoeda } from '@/lib/format'

function item(id: string, extra: Partial<ItemAlmoxarifado> = {}): ItemAlmoxarifado {
  return {
    id,
    obra_id: 'o1',
    categoria: 'ALVENARIA E PISO',
    descricao: 'CIMENTO CP II 50KG',
    unidade: 'sc',
    quantidade: 10,
    cor_bitola: null,
    metragem: null,
    custo_unitario: 4200,
    valor_cobranca: 5000,
    ...extra,
  }
}

let n = 0
function saida(item_id: string, quantidade: number, extra: Partial<SaidaAlmoxarifado> = {}): SaidaAlmoxarifado {
  return {
    id: `s${++n}`,
    item_id,
    data: '2026-08-05',
    quantidade,
    quem_pegou: 'Antonio',
    onde_usou: 'contrapiso',
    cobrar_cliente: false,
    ...extra,
  }
}

describe('saldo do item', () => {
  it('desconta as saidas da quantidade', () => {
    const [i] = calcularSaldos([item('i1')], [saida('i1', 3), saida('i1', 2)])
    expect(i!.total_saidas).toBe(5)
    expect(i!.saldo).toBe(5)
  })

  it('aceita item sem quantidade definida (a contar depois)', () => {
    const [i] = calcularSaldos([item('i1', { quantidade: null })], [saida('i1', 3)])
    expect(i!.saldo).toBeNull()
    expect(i!.total_saidas).toBe(3)
  })

  it('apura o custo das saidas, que nunca vai ao cliente', () => {
    const [i] = calcularSaldos([item('i1')], [saida('i1', 4)])
    expect(formatarMoeda(i!.custo_saidas)).toBe('R$ 168,00') // 4 x R$ 42,00
  })
})

describe('caso 18 — saida marcada para cobrar do cliente', () => {
  const itens = [item('i1')]
  const saidas = [
    saida('i1', 2, { cobrar_cliente: true }),
    saida('i1', 3, { cobrar_cliente: false }),
  ]

  it('so a saida marcada entra valorada no fechamento', () => {
    const [i] = calcularSaldos(itens, saidas)
    expect(i!.quantidade_cobrada).toBe(2)
    expect(formatarMoeda(i!.valor_cobrado)).toBe('R$ 100,00') // 2 x R$ 50,00
  })

  it('o total cobrado do almoxarifado soma so o que foi marcado', () => {
    const r = resumirAlmoxarifado(itens, saidas)
    expect(formatarMoeda(r.total_cobrado)).toBe('R$ 100,00')
    expect(formatarMoeda(r.custo_total_saidas)).toBe('R$ 210,00') // 5 x R$ 42,00
  })
})

describe('caso 17 — baixa de um pedaco de cabo', () => {
  // Tres pedacos de cabo: dois vermelhos 2,5mm e um azul 4mm.
  const itens = [
    item('c1', {
      categoria: 'ELETRICA',
      descricao: 'CABO FLEXIVEL',
      unidade: 'm',
      quantidade: 50,
      metragem: 50,
      cor_bitola: 'vermelho 2,5mm',
      valor_cobranca: 320,
      custo_unitario: 250,
    }),
    item('c2', {
      categoria: 'ELETRICA',
      descricao: 'CABO FLEXIVEL',
      unidade: 'm',
      quantidade: 30,
      metragem: 30,
      cor_bitola: 'VERMELHO 2,5MM',
      valor_cobranca: 320,
      custo_unitario: 250,
    }),
    item('c3', {
      categoria: 'ELETRICA',
      descricao: 'CABO FLEXIVEL',
      unidade: 'm',
      quantidade: 20,
      metragem: 20,
      cor_bitola: 'azul 4mm',
      valor_cobranca: 480,
      custo_unitario: 400,
    }),
  ]

  it('a metragem restante do pedaco cai com a baixa', () => {
    const comSaldo = calcularSaldos(itens, [saida('c1', 12.5, { cobrar_cliente: true })])
    const c1 = comSaldo.find((i) => i.id === 'c1')!
    expect(c1.saldo_metragem).toBe(37.5)
    expect(c1.saldo).toBe(37.5)
  })

  it('o subtotal por cor e bitola acompanha a baixa', () => {
    const comSaldo = calcularSaldos(itens, [saida('c1', 12.5)])
    const sub = subtotaisPorCorBitola(comSaldo)

    const vermelho = sub.find((s) => s.cor_bitola === 'VERMELHO 2,5MM')!
    expect(vermelho.quantidade_pedacos).toBe(2) // agrupa apesar da grafia diferente
    expect(vermelho.metragem_total).toBe(80)
    expect(vermelho.metragem_restante).toBe(67.5)

    const azul = sub.find((s) => s.cor_bitola === 'AZUL 4MM')!
    expect(azul.metragem_restante).toBe(20)
  })

  it('nao acumula erro de ponto flutuante na metragem', () => {
    const comSaldo = calcularSaldos(
      [item('c9', { quantidade: 0.3, metragem: 0.3 })],
      [saida('c9', 0.1)],
    )
    expect(comSaldo[0]!.saldo).toBe(0.2)
  })
})

describe('agrupamento por categoria', () => {
  const itens = [
    item('i1', { categoria: 'eletrica', descricao: 'DISJUNTOR 20A' }),
    item('i2', { categoria: 'ELETRICA', descricao: 'CABO PP 3X2,5' }),
    item('i3', { categoria: 'hidraulica', descricao: 'TUBO PVC 25MM' }),
  ]

  it('normaliza a categoria em caixa alta e junta as grafias', () => {
    const grupos = agruparPorCategoria(calcularSaldos(itens, []))
    expect(grupos.map((g) => g.categoria)).toEqual(['ELETRICA', 'HIDRAULICA'])
    expect(grupos[0]!.itens).toHaveLength(2)
  })

  it('ordena os itens dentro da categoria', () => {
    const grupos = agruparPorCategoria(calcularSaldos(itens, []))
    expect(grupos[0]!.itens.map((i) => i.descricao)).toEqual(['CABO PP 3X2,5', 'DISJUNTOR 20A'])
  })

  it('conta os itens ainda sem quantidade', () => {
    const r = resumirAlmoxarifado([...itens, item('i4', { quantidade: null })], [])
    expect(r.itens_sem_quantidade).toBe(1)
  })
})
