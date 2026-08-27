import { describe, expect, it } from 'vitest'
import {
  chaveDoProduto,
  comSituacao,
  compararCotacoes,
  menorPrecoVigente,
  situacaoDoPreco,
  totalDaCotacao,
  type CotacaoCabecalho,
  type ItemCotacao,
} from './cotacoes'
import { formatarMoeda } from '@/lib/format'

const HOJE = '2026-08-27'

function cotacao(id: string, extra: Partial<CotacaoCabecalho> = {}): CotacaoCabecalho {
  return {
    id,
    fornecedor_id: `f-${id}`,
    fornecedor_nome: `Fornecedor ${id}`,
    numero_documento: '0000102431',
    data: '2026-08-25',
    vendedor: null,
    validade: '2026-09-25',
    condicao_pagamento: 'à vista no Pix',
    total: 470800,
    base: false,
    ...extra,
  }
}

let n = 0
function item(cotacao_id: string, preco: number, extra: Partial<ItemCotacao> = {}): ItemCotacao {
  return {
    id: `i${++n}`,
    cotacao_id,
    categoria: 'modulo',
    marca: 'Canadian',
    modelo: 'CS7L-610',
    especificacao: '610 Wp',
    unidade: 'un',
    quantidade: 1,
    preco_unitario: preco,
    estimado: false,
    substituido: false,
    ...extra,
  }
}

describe('caso 28 — dois fornecedores com preços diferentes para o mesmo módulo', () => {
  const cotacoes = [cotacao('a'), cotacao('b')]
  const itens = [item('a', 85000), item('b', 79000)]

  it('a cotação puxa o menor preço vigente', () => {
    const grupos = menorPrecoVigente(comSituacao(itens, cotacoes, HOJE))
    expect(grupos).toHaveLength(1)
    expect(formatarMoeda(grupos[0]!.escolhido.preco_unitario)).toBe('R$ 790,00')
    expect(grupos[0]!.escolhido.cotacao.fornecedor_nome).toBe('Fornecedor b')
  })

  it('mantém a alternativa à vista, para trocar o fornecedor manualmente', () => {
    const grupos = menorPrecoVigente(comSituacao(itens, cotacoes, HOJE))
    expect(grupos[0]!.alternativas).toHaveLength(1)
    expect(formatarMoeda(grupos[0]!.alternativas[0]!.preco_unitario)).toBe('R$ 850,00')
  })

  it('agrupa o mesmo produto apesar da grafia diferente', () => {
    expect(chaveDoProduto({ categoria: 'modulo', marca: 'canadian', modelo: 'cs7l-610', especificacao: '610 wp' })).toBe(
      chaveDoProduto({ categoria: 'MODULO', marca: 'Canadian', modelo: 'CS7L-610', especificacao: '610 Wp' }),
    )
  })

  it('separa produtos diferentes', () => {
    const grupos = menorPrecoVigente(
      comSituacao(
        [item('a', 85000), item('b', 79000, { modelo: 'JKM-550', especificacao: '550 Wp' })],
        cotacoes,
        HOJE,
      ),
    )
    expect(grupos).toHaveLength(2)
  })
})

describe('caso 29 — preço com validade vencida', () => {
  const vencida = cotacao('velha', { data: '2026-05-01', validade: '2026-06-01' })
  const vigente = cotacao('nova', { data: '2026-08-20', validade: '2026-09-20' })

  it('sinaliza o item com cotação vencida', () => {
    expect(situacaoDoPreco(vencida, HOJE)).toBe('vencido')
    expect(situacaoDoPreco(vigente, HOJE)).toBe('vigente')
  })

  it('sinaliza também a cotação sem validade com mais de 30 dias', () => {
    const antiga = cotacao('antiga', { data: '2026-06-01', validade: null })
    expect(situacaoDoPreco(antiga, HOJE)).toBe('antigo')
    const recente = cotacao('recente', { data: '2026-08-20', validade: null })
    expect(situacaoDoPreco(recente, HOJE)).toBe('vigente')
  })

  it('respeita o limite de dias configurado em parâmetros', () => {
    const c = cotacao('c', { data: '2026-08-01', validade: null })
    expect(situacaoDoPreco(c, HOJE, 30)).toBe('vigente')
    expect(situacaoDoPreco(c, HOJE, 10)).toBe('antigo')
  })

  it('preço vencido mais barato não ganha do vigente mais caro', () => {
    const grupos = menorPrecoVigente(
      comSituacao([item('velha', 50000), item('nova', 79000)], [vencida, vigente], HOJE),
    )
    expect(formatarMoeda(grupos[0]!.escolhido.preco_unitario)).toBe('R$ 790,00')
    expect(grupos[0]!.escolhido.situacao).toBe('vigente')
  })

  it('mas se só houver preço vencido, ele é usado e sai sinalizado', () => {
    const grupos = menorPrecoVigente(comSituacao([item('velha', 50000)], [vencida], HOJE))
    expect(grupos[0]!.escolhido.situacao).toBe('vencido')
    expect(grupos[0]!.escolhido.dias_desde_cotacao).toBe(118)
  })
})

describe('histórico e itens sinalizados', () => {
  it('cada nova cotação é um registro novo: as duas continuam disponíveis', () => {
    const cotacoes = [
      cotacao('a', { data: '2026-07-01', validade: '2026-08-01' }),
      cotacao('b', { data: '2026-08-20', validade: '2026-09-20' }),
    ]
    const comSit = comSituacao([item('a', 85000), item('b', 79000)], cotacoes, HOJE)
    expect(comSit).toHaveLength(2)
    expect(comSit.map((i) => i.situacao)).toEqual(['vencido', 'vigente'])
  })

  it('mantém a marcação de item estimado e de item substituído', () => {
    // Caso real: parafuso soberba 8x80, 174 un a R$ 1,50, que faltou na cotacao
    const itens = [
      item('a', 150, { categoria: 'parafuso', marca: null, modelo: 'soberba 8x80', quantidade: 174, estimado: true }),
      item('a', 4200, { categoria: 'perfil', modelo: 'equivalente', substituido: true }),
    ]
    const comSit = comSituacao(itens, [cotacao('a')], HOJE)
    expect(comSit[0]!.estimado).toBe(true)
    expect(comSit[1]!.substituido).toBe(true)
  })

  it('ignora item cuja cotação não foi carregada', () => {
    expect(comSituacao([item('fantasma', 100)], [cotacao('a')], HOJE)).toEqual([])
  })
})

describe('total da cotação e comparativo lado a lado', () => {
  it('soma quantidade x preço unitário', () => {
    // orcamento de material de forro: documento 0000102431, R$ 4.708,00 a vista
    const itens = [
      item('a', 4200, { quantidade: 100, categoria: 'placa' }),
      item('a', 150, { quantidade: 174, categoria: 'parafuso', estimado: true }),
      item('a', 2200, { quantidade: 10, categoria: 'perfil' }),
    ]
    expect(formatarMoeda(totalDaCotacao(itens))).toBe('R$ 4.681,00')
  })

  it('usa quantidade 1 quando não informada', () => {
    expect(totalDaCotacao([item('a', 5000, { quantidade: null })])).toBe(5000)
  })

  it('compara duas cotações do mesmo escopo, apontando a mais barata', () => {
    const cotacoes = [cotacao('a', { fornecedor_nome: 'Kalfort' }), cotacao('b', { fornecedor_nome: 'Ponto do Gesso' })]
    const itens = [
      item('a', 4200, { categoria: 'placa', modelo: 'ST 12,5mm', especificacao: null }),
      item('b', 3900, { categoria: 'placa', modelo: 'ST 12,5mm', especificacao: null }),
      item('a', 2200, { categoria: 'perfil', modelo: 'F530', especificacao: null }),
    ]
    const comp = compararCotacoes(cotacoes, itens)

    const placa = comp.find((c) => c.chave.includes('PLACA'))!
    expect(placa.precos).toEqual([4200, 3900])
    expect(placa.menor).toBe(3900)
    expect(placa.indice_menor).toBe(1)

    // item que so uma das cotacoes tem
    const perfil = comp.find((c) => c.chave.includes('PERFIL'))!
    expect(perfil.precos).toEqual([2200, null])
    expect(perfil.indice_menor).toBe(0)
  })
})
