import { describe, expect, it } from 'vitest'
import {
  calcularItem,
  calcularOrcamento,
  compararFases,
  custoPorUnidade,
  montarFases,
  type ConfiguracaoOrcamento,
  type ItemOrcamento,
} from './orcamento'
import { formatarMoeda } from '@/lib/format'

let n = 0
function item(extra: Partial<ItemOrcamento> = {}): ItemOrcamento {
  return {
    id: `i${++n}`,
    fase: null,
    codigo_referencia: null,
    base_referencia: 'proprio',
    descricao: 'Alvenaria de vedação',
    unidade: 'm2',
    quantidade: 100,
    custo_material: 3000, // R$ 30,00/m²
    custo_mao_obra: 2000, // R$ 20,00/m²
    preco_unitario: null,
    terceirizado_sem_valor: false,
    ordem: n,
    ...extra,
  }
}

const CFG: ConfiguracaoOrcamento = { margem: 0.3, bdi: 0.25, modo_bdi: 'sem_bdi' }

describe('cálculo do item', () => {
  it('soma material e mão de obra no custo unitário', () => {
    const c = calcularItem(item(), CFG)
    expect(formatarMoeda(c.custo_unitario)).toBe('R$ 50,00')
    expect(formatarMoeda(c.custo_total)).toBe('R$ 5.000,00')
  })

  it('aplica a margem para chegar ao preço de venda', () => {
    const c = calcularItem(item(), CFG)
    expect(formatarMoeda(c.preco_base_unitario)).toBe('R$ 65,00') // 50 x 1,30
    expect(formatarMoeda(c.total)).toBe('R$ 6.500,00')
    expect(formatarMoeda(c.margem_valor)).toBe('R$ 1.500,00')
  })

  it('o preço unitário informado manda sobre o cálculo por margem', () => {
    // caso do item de base referencial, que ja vem com preco
    const c = calcularItem(
      item({ base_referencia: 'SINAPI', codigo_referencia: '87449', preco_unitario: 8000 }),
      CFG,
    )
    expect(formatarMoeda(c.preco_base_unitario)).toBe('R$ 80,00')
    expect(formatarMoeda(c.total)).toBe('R$ 8.000,00')
  })

  it('item sem custo e sem preço não inventa valor', () => {
    const c = calcularItem(item({ custo_material: null, custo_mao_obra: null }), CFG)
    expect(c.preco_base_unitario).toBe(0)
    expect(c.total).toBe(0)
  })
})

describe('caso 22 — item terceirizado sem valor', () => {
  const itens = [
    item({ descricao: 'Alvenaria', quantidade: 100 }),
    item({
      descricao: 'Mármores e granitos',
      terceirizado_sem_valor: true,
      custo_material: null,
      custo_mao_obra: null,
      quantidade: null,
    }),
  ]

  it('aparece descrito e não soma no total', () => {
    const o = calcularOrcamento(itens, CFG)
    expect(o.itens).toHaveLength(2)
    expect(o.itens[1]!.descricao).toBe('Mármores e granitos')
    expect(o.itens[1]!.total).toBe(0)
    expect(formatarMoeda(o.totais.total)).toBe('R$ 6.500,00') // só a alvenaria
  })

  it('é contado à parte, para o documento avisar', () => {
    const o = calcularOrcamento(itens, CFG)
    expect(o.totais.itens_sem_valor).toBe(1)
  })

  it('não soma nem quando tem preço preenchido por engano', () => {
    const o = calcularOrcamento(
      [item({ terceirizado_sem_valor: true, preco_unitario: 50000, quantidade: 10 })],
      CFG,
    )
    expect(o.totais.total).toBe(0)
    expect(o.totais.custo_total).toBe(0)
  })
})

describe('caso 20 — BDI de 25% no modo embutido', () => {
  // Dois itens de valor redondo, para o BDI fechar no centavo.
  const itens = [
    item({ descricao: 'Alvenaria', quantidade: 100, custo_material: 3000, custo_mao_obra: 2000 }),
    item({ descricao: 'Reboco', quantidade: 200, custo_material: 1000, custo_mao_obra: 1000 }),
  ]

  const semBdi = calcularOrcamento(itens, { margem: 0.3, bdi: 0.25, modo_bdi: 'sem_bdi' })
  const visivel = calcularOrcamento(itens, { margem: 0.3, bdi: 0.25, modo_bdi: 'visivel' })
  const embutido = calcularOrcamento(itens, { margem: 0.3, bdi: 0.25, modo_bdi: 'embutido' })

  it('sem BDI, o total é a soma pura dos itens', () => {
    // alvenaria 100 x 65,00 = 6.500,00 | reboco 200 x 26,00 = 5.200,00
    expect(formatarMoeda(semBdi.totais.subtotal)).toBe('R$ 11.700,00')
    expect(semBdi.totais.valor_bdi).toBe(0)
    expect(formatarMoeda(semBdi.totais.total)).toBe('R$ 11.700,00')
  })

  it('no modo visível o BDI é uma linha à parte', () => {
    expect(formatarMoeda(visivel.totais.subtotal)).toBe('R$ 11.700,00')
    expect(formatarMoeda(visivel.totais.valor_bdi)).toBe('R$ 2.925,00')
    expect(formatarMoeda(visivel.totais.total)).toBe('R$ 14.625,00')
  })

  it('no modo embutido não existe linha de BDI', () => {
    expect(embutido.totais.valor_bdi).toBe(0)
  })

  it('mas o total do modo embutido bate com o do modo visível', () => {
    expect(embutido.totais.total).toBe(visivel.totais.total)
    expect(formatarMoeda(embutido.totais.total)).toBe('R$ 14.625,00')
  })

  it('o preço unitário do modo embutido já vem com o BDI dentro', () => {
    expect(formatarMoeda(embutido.itens[0]!.preco_exibido_unitario)).toBe('R$ 81,25') // 65 x 1,25
    expect(formatarMoeda(embutido.itens[1]!.preco_exibido_unitario)).toBe('R$ 32,50') // 26 x 1,25
  })

  it('o custo apurado é o mesmo nos três modos — o BDI não muda o custo', () => {
    expect(semBdi.totais.custo_total).toBe(visivel.totais.custo_total)
    expect(visivel.totais.custo_total).toBe(embutido.totais.custo_total)
    expect(formatarMoeda(embutido.totais.custo_total)).toBe('R$ 9.000,00')
  })
})

describe('arredondamento do BDI embutido', () => {
  // Com preco unitario quebrado, o total do embutido pode divergir do visivel
  // em centavos, porque o preco unitario impresso e arredondado item a item.
  // O que nao pode e a soma das linhas nao bater com o total impresso.
  const itens = [
    item({ quantidade: 3, preco_unitario: 3333, custo_material: null, custo_mao_obra: null }),
    item({ quantidade: 7, preco_unitario: 1111, custo_material: null, custo_mao_obra: null }),
  ]
  const embutido = calcularOrcamento(itens, { margem: 0, bdi: 0.25, modo_bdi: 'embutido' })
  const visivel = calcularOrcamento(itens, { margem: 0, bdi: 0.25, modo_bdi: 'visivel' })

  it('a soma das linhas é exatamente o total impresso', () => {
    const soma = embutido.itens.reduce((s, i) => s + i.total, 0)
    expect(soma).toBe(embutido.totais.total)
  })

  it('a diferença para o modo visível fica dentro de centavos por item', () => {
    const diferenca = Math.abs(embutido.totais.total - visivel.totais.total)
    expect(diferenca).toBeLessThanOrEqual(embutido.itens.length)
  })
})

describe('caso 21 — mesmo orçamento com e sem preço unitário', () => {
  it('o total é o mesmo; o que muda é o que aparece', () => {
    const itens = [item({ quantidade: 100 }), item({ quantidade: 50, custo_material: 1000, custo_mao_obra: 500 })]
    const o = calcularOrcamento(itens, CFG)
    // com unitario: 100 x 65,00 + 50 x 19,50 ; sem unitario: os mesmos totais
    expect(formatarMoeda(o.itens[0]!.total)).toBe('R$ 6.500,00')
    expect(formatarMoeda(o.itens[1]!.total)).toBe('R$ 975,00')
    expect(formatarMoeda(o.totais.total)).toBe('R$ 7.475,00')
  })
})

describe('fases hierárquicas do orçamento completo', () => {
  const itens = [
    item({ fase: '1', descricao: 'Serviços preliminares', quantidade: 1, preco_unitario: 100000, custo_material: null, custo_mao_obra: null }),
    item({ fase: '1.1', descricao: 'Canteiro de obras', quantidade: 1, preco_unitario: 50000, custo_material: null, custo_mao_obra: null }),
    item({ fase: '1.1.1', descricao: 'Barracão', quantidade: 1, preco_unitario: 30000, custo_material: null, custo_mao_obra: null }),
    item({ fase: '2', descricao: 'Estrutura', quantidade: 1, preco_unitario: 200000, custo_material: null, custo_mao_obra: null }),
  ]
  const fases = montarFases(calcularOrcamento(itens, CFG).itens)

  it('lista as fases em ordem numérica, não alfabética', () => {
    expect(fases.map((f) => f.fase)).toEqual(['1', '1.1', '1.1.1', '2'])
    expect(compararFases('1.10', '1.2')).toBeGreaterThan(0)
    expect(compararFases('1.1.1', '1.2')).toBeLessThan(0)
    expect(compararFases('2', '10')).toBeLessThan(0)
  })

  it('marca o nível de cada fase', () => {
    expect(fases.map((f) => f.nivel)).toEqual([1, 2, 3, 1])
  })

  it('o subtotal da fase-mãe inclui as subfases', () => {
    expect(formatarMoeda(fases[0]!.subtotal)).toBe('R$ 1.800,00') // 1000 + 500 + 300
    expect(formatarMoeda(fases[1]!.subtotal)).toBe('R$ 800,00') // 500 + 300
    expect(formatarMoeda(fases[2]!.subtotal)).toBe('R$ 300,00')
    expect(formatarMoeda(fases[3]!.subtotal)).toBe('R$ 2.000,00')
  })

  it('cria a fase-mãe mesmo quando só as filhas têm item', () => {
    const soFilhas = montarFases(
      calcularOrcamento([item({ fase: '3.1.2', quantidade: 1, preco_unitario: 10000, custo_material: null, custo_mao_obra: null })], CFG).itens,
    )
    expect(soFilhas.map((f) => f.fase)).toEqual(['3', '3.1', '3.1.2'])
    expect(soFilhas[0]!.subtotal).toBe(10000)
  })

  it('orçamento rápido, sem fases, não monta hierarquia', () => {
    expect(montarFases(calcularOrcamento([item()], CFG).itens)).toEqual([])
  })
})

describe('itens de base referencial convivendo com itens próprios', () => {
  const itens = [
    item({ base_referencia: 'SINAPI', codigo_referencia: '87449', preco_unitario: 8000, custo_material: null, custo_mao_obra: null }),
    item({ base_referencia: 'ORSE', codigo_referencia: '02145', preco_unitario: 4500, quantidade: 50, custo_material: null, custo_mao_obra: null }),
    item({ base_referencia: 'proprio', descricao: 'Mão de obra RV' }),
  ]

  it('guarda a base e o código de cada item, para a planilha distinguir', () => {
    const o = calcularOrcamento(itens, CFG)
    expect(o.itens.map((i) => i.base_referencia)).toEqual(['SINAPI', 'ORSE', 'proprio'])
    expect(o.itens[0]!.codigo_referencia).toBe('87449')
  })

  it('soma os dois tipos no mesmo total', () => {
    const o = calcularOrcamento(itens, CFG)
    // 100 x 80,00 + 50 x 45,00 + 100 x 65,00
    expect(formatarMoeda(o.totais.total)).toBe('R$ 16.750,00')
  })
})

describe('custo por unidade (spec 6.2)', () => {
  it('apura o custo por m² e sugere o preço pela margem', () => {
    // cotacao base de R$ 4.708,00 para 101,94 m²
    const r = custoPorUnidade(470800, 101.94, 0.3)
    expect(formatarMoeda(r.custo_unitario)).toBe('R$ 46,18')
    expect(formatarMoeda(r.preco_sugerido)).toBe('R$ 60,03')
  })

  it('não divide por zero', () => {
    expect(custoPorUnidade(100000, 0, 0.3)).toEqual({ custo_unitario: 0, preco_sugerido: 0 })
  })
})
