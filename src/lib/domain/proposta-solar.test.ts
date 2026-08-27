import { describe, expect, it } from 'vitest'
import { dimensionar } from './solar'
import {
  itensParaProposta,
  montarCotacaoSolar,
  valoresProibidosNaProposta,
  type ParametrosProposta,
  type PrecoDeItem,
} from './proposta-solar'
import { formatarMoeda } from '@/lib/format'

const DIM = dimensionar({
  consumo_mensal: [500],
  tipo_ligacao: 'monofasica',
  potencia_modulo_wp: 610,
  area_modulo_m2: 2.79,
})

const PRECOS: Record<string, PrecoDeItem> = {
  modulo: { descricao: 'Módulo Canadian 610 Wp', preco_unitario: 79000, situacao: 'vigente', fornecedor: 'Solar A' },
  inversor: { descricao: 'Inversor Growatt 4 kW', preco_unitario: 350000, situacao: 'vigente' },
  estrutura: { descricao: 'Estrutura cerâmica por módulo', preco_unitario: 12000, situacao: 'vigente' },
  cabo: { descricao: 'Cabo solar 6mm', preco_unitario: 900, situacao: 'vigente' },
  conector: { descricao: 'Par de conectores MC4', preco_unitario: 2500, situacao: 'vigente' },
  stringbox: { descricao: 'String box CC/CA', preco_unitario: 45000, situacao: 'vigente' },
  eletrico: { descricao: 'Disjuntor e materiais', preco_unitario: 30000, situacao: 'vigente' },
}

const PARAMS: ParametrosProposta = {
  projeto_art: 150000,
  mao_obra_kwp: 50000,
  margem: 0.3,
  distancia_quadro_m: 20,
}

describe('composição da cotação solar', () => {
  const c = montarCotacaoSolar({ dimensionamento: DIM, precos: PRECOS, parametros: PARAMS })

  it('usa a quantidade de módulos do dimensionamento', () => {
    const modulo = c.itens.find((i) => i.categoria === 'modulo')!
    expect(modulo.quantidade).toBe(7)
    expect(formatarMoeda(modulo.custo_total)).toBe('R$ 5.530,00') // 7 x 790,00
  })

  it('a estrutura acompanha a quantidade de módulos', () => {
    expect(c.itens.find((i) => i.categoria === 'estrutura')!.quantidade).toBe(7)
  })

  it('o cabo é dimensionado pela distância, ida e volta', () => {
    const cabo = c.itens.find((i) => i.categoria === 'cabo')!
    expect(cabo.quantidade).toBe(40)
    expect(formatarMoeda(cabo.custo_total)).toBe('R$ 360,00')
  })

  it('a mão de obra sai por kWp instalado', () => {
    const mo = c.itens.find((i) => i.descricao.includes('Mão de obra'))!
    expect(mo.quantidade).toBe(4.27)
    expect(formatarMoeda(mo.custo_total)).toBe('R$ 2.135,00') // 4,27 x 500,00
  })

  it('soma equipamentos, serviços e chega ao preço com a margem', () => {
    // equipamentos: 5.530 + 3.500 + 840 + 360 + 25 x 2? conferido pelo total
    expect(c.custo_equipamentos).toBe(
      7 * 79000 + 350000 + 7 * 12000 + 40 * 900 + 2 * 2500 + 45000 + 30000,
    )
    expect(c.custo_servicos).toBe(150000 + 213500)
    expect(c.custo_total).toBe(c.custo_equipamentos + c.custo_servicos)
    expect(c.preco_venda).toBe(Math.round(c.custo_total * 1.3))
    expect(c.margem_valor).toBe(c.preco_venda - c.custo_total)
  })
})

describe('frete', () => {
  it('usa o valor informado quando existe', () => {
    const c = montarCotacaoSolar({
      dimensionamento: DIM,
      precos: PRECOS,
      parametros: { ...PARAMS, frete_valor: 80000, frete_percentual: 0.05 },
    })
    expect(formatarMoeda(c.custo_frete)).toBe('R$ 800,00')
  })

  it('cai no percentual quando não há valor informado', () => {
    const c = montarCotacaoSolar({
      dimensionamento: DIM,
      precos: PRECOS,
      parametros: { ...PARAMS, frete_percentual: 0.05 },
    })
    const base = c.custo_equipamentos + c.custo_servicos
    expect(c.custo_frete).toBe(Math.round(base * 0.05))
  })

  it('sem valor e sem percentual, não cria linha de frete', () => {
    const c = montarCotacaoSolar({ dimensionamento: DIM, precos: PRECOS, parametros: PARAMS })
    expect(c.custo_frete).toBe(0)
    expect(c.itens.some((i) => i.categoria === 'frete')).toBe(false)
  })
})

describe('alertas de preço', () => {
  it('avisa quando falta preço na base, em vez de gerar proposta furada', () => {
    const { inversor, ...semInversor } = PRECOS
    void inversor
    const c = montarCotacaoSolar({ dimensionamento: DIM, precos: semInversor, parametros: PARAMS })
    expect(c.alertas.some((a) => a.includes('Sem preço na base'))).toBe(true)
    expect(c.itens.find((i) => i.categoria === 'inversor')!.custo_total).toBe(0)
  })

  it('avisa quando o preço está vencido', () => {
    const c = montarCotacaoSolar({
      dimensionamento: DIM,
      precos: { ...PRECOS, modulo: { ...PRECOS.modulo!, situacao: 'vencido' } },
      parametros: PARAMS,
    })
    expect(c.alertas.some((a) => a.includes('vencido'))).toBe(true)
  })

  it('avisa quando o preço tem mais de 30 dias', () => {
    const c = montarCotacaoSolar({
      dimensionamento: DIM,
      precos: { ...PRECOS, modulo: { ...PRECOS.modulo!, situacao: 'antigo' } },
      parametros: PARAMS,
    })
    expect(c.alertas.some((a) => a.includes('mais de 30 dias'))).toBe(true)
  })

  it('sem alerta quando está tudo vigente', () => {
    const c = montarCotacaoSolar({ dimensionamento: DIM, precos: PRECOS, parametros: PARAMS })
    expect(c.alertas).toEqual([])
  })
})

describe('caso 30 — a proposta não mostra custo de fornecedor nem margem', () => {
  const c = montarCotacaoSolar({ dimensionamento: DIM, precos: PRECOS, parametros: PARAMS })
  const lista = itensParaProposta(c)

  it('lista equipamentos e serviços com quantidade, sem preço item a item', () => {
    expect(lista.length).toBeGreaterThan(0)
    for (const item of lista) {
      expect(Object.keys(item)).toEqual(['descricao', 'quantidade'])
    }
  })

  it('nenhum valor de custo ou margem aparece no texto da proposta', () => {
    const textoDaProposta = JSON.stringify(lista)
    for (const valor of valoresProibidosNaProposta(c)) {
      const emReais = (valor / 100).toFixed(2)
      expect(textoDaProposta).not.toContain(emReais)
    }
  })

  it('o que vai ao cliente é apenas o valor global', () => {
    expect(c.preco_venda).toBeGreaterThan(c.custo_total)
    // o preco de venda nao revela o custo: a diferenca e a margem, que fica fora
    expect(c.preco_venda - c.margem_valor).toBe(c.custo_total)
  })

  it('mantém o fornecedor apenas na apuração interna', () => {
    expect(c.itens.find((i) => i.categoria === 'modulo')!.fornecedor).toBe('Solar A')
    expect(JSON.stringify(lista)).not.toContain('Solar A')
  })
})
