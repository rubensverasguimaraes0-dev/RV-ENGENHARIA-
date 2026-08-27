import { describe, expect, it } from 'vitest'
import {
  apurarServico,
  montarFechamento,
  type Adiantamento,
  type ServicoExecutado,
} from './fechamento-debitos'
import {
  colunasDoRelatorio,
  lerVersao,
  versaoDaQuery,
  versaoParaCliente,
  versaoParaQuery,
  VERSAO_PADRAO,
} from './versoes-exibicao'
import { formatarMoeda } from '@/lib/format'

let n = 0
function servico(extra: Partial<ServicoExecutado> = {}): ServicoExecutado {
  return {
    id: `s${++n}`,
    obra_id: 'o1',
    local_id: null,
    grupo: 'Obras civis',
    descricao: 'Contrapiso',
    valor: 500000,
    executado: true,
    valor_deducao: 0,
    justificativa_deducao: null,
    ordem: n,
    ...extra,
  }
}

function adiantamento(extra: Partial<Adiantamento> = {}): Adiantamento {
  return {
    id: 'p1',
    numero_parcela: 1,
    data_recebimento: '2026-08-10',
    forma_pagamento: 'pix',
    valor_recebido: 300000,
    valor_outro_contrato: 0,
    observacao: null,
    ...extra,
  }
}

describe('caso 16 — serviço não executado e dedução parcial', () => {
  const servicos = [
    servico({ descricao: 'Contrapiso', valor: 500000 }),
    servico({
      descricao: 'Pintura da fachada',
      valor: 200000,
      executado: false,
      justificativa_deducao: 'Cliente optou por não executar nesta etapa.',
    }),
    servico({
      descricao: 'Forro do salão',
      valor: 300000,
      executado: true,
      valor_deducao: 100000,
      justificativa_deducao: 'Executado 2/3 do previsto.',
    }),
  ]

  const f = montarFechamento({
    servicos,
    adiantamentos: [adiantamento({ valor_recebido: 400000 })],
    notas_a_repassar: 150000,
    almoxarifado_cobrado: 50000,
  })

  it('serviço não executado deduz o valor inteiro', () => {
    const a = apurarServico(servicos[1]!)
    expect(a.deducao_efetiva).toBe(200000)
    expect(a.valor_liquido).toBe(0)
  })

  it('serviço executado deduz apenas a parte informada', () => {
    const a = apurarServico(servicos[2]!)
    expect(a.deducao_efetiva).toBe(100000)
    expect(a.valor_liquido).toBe(200000)
  })

  it('soma os serviços líquidos', () => {
    expect(formatarMoeda(f.servicos_bruto)).toBe('R$ 10.000,00')
    expect(formatarMoeda(f.total_deducoes)).toBe('R$ 3.000,00')
    expect(formatarMoeda(f.servicos_liquidos)).toBe('R$ 7.000,00')
  })

  it('calcula o saldo devedor', () => {
    // 7.000,00 líquidos - 4.000,00 de adiantamento + 1.500,00 de notas + 500,00 de material
    expect(formatarMoeda(f.saldo_devedor)).toBe('R$ 5.000,00')
  })

  it('leva as justificativas para os esclarecimentos ao final', () => {
    expect(f.esclarecimentos).toHaveLength(2)
    expect(f.esclarecimentos[0]!.justificativa).toContain('não executar')
    expect(f.esclarecimentos[1]!.valor).toBe(100000)
  })

  it('usa uma justificativa padrão quando não foi escrita nenhuma', () => {
    const semTexto = montarFechamento({
      servicos: [servico({ valor: 100000, executado: false, justificativa_deducao: null })],
      adiantamentos: [],
      notas_a_repassar: 0,
      almoxarifado_cobrado: 0,
    })
    expect(semTexto.esclarecimentos[0]!.justificativa).toBe('Item orçado e não executado.')
  })

  it('não deixa a dedução passar do valor do serviço', () => {
    const a = apurarServico(servico({ valor: 100000, valor_deducao: 150000 }))
    expect(a.deducao_efetiva).toBe(100000)
    expect(a.valor_liquido).toBe(0)
  })
})

describe('adiantamento com valor de outro contrato', () => {
  it('só o que é desta obra abate o saldo devedor', () => {
    const f = montarFechamento({
      servicos: [servico({ valor: 1000000 })],
      adiantamentos: [
        adiantamento({ valor_recebido: 400000, valor_outro_contrato: 100000, observacao: 'saldo do contrato anterior' }),
      ],
      notas_a_repassar: 0,
      almoxarifado_cobrado: 0,
    })
    expect(formatarMoeda(f.total_adiantamentos)).toBe('R$ 3.000,00')
    expect(formatarMoeda(f.total_outro_contrato)).toBe('R$ 1.000,00')
    expect(formatarMoeda(f.saldo_devedor)).toBe('R$ 7.000,00')
  })
})

describe('agrupamento dos serviços', () => {
  const servicos = [
    servico({ grupo: 'Elétrica', descricao: 'Pontos de tomada', valor: 100000, local_id: 'apto1802' }),
    servico({ grupo: 'Obras civis', descricao: 'Contrapiso', valor: 300000, local_id: 'apto1802' }),
    servico({ grupo: 'Elétrica', descricao: 'Quadro de distribuição', valor: 200000, local_id: 'apto1301' }),
  ]

  it('agrupa por frente de trabalho com subtotal', () => {
    const f = montarFechamento({
      servicos,
      adiantamentos: [],
      notas_a_repassar: 0,
      almoxarifado_cobrado: 0,
    })
    expect(f.grupos.map((g) => g.grupo)).toEqual(['Elétrica', 'Obras civis'])
    expect(formatarMoeda(f.grupos[0]!.subtotal)).toBe('R$ 3.000,00')
    expect(formatarMoeda(f.grupos[1]!.subtotal)).toBe('R$ 3.000,00')
  })

  it('agrupa por local, para o relatório com um bloco por local', () => {
    const f = montarFechamento({
      servicos,
      adiantamentos: [],
      notas_a_repassar: 0,
      almoxarifado_cobrado: 0,
      agrupamento: 'local',
      nomeLocal: new Map([
        ['apto1802', 'Apto 1802'],
        ['apto1301', 'Apto 1301'],
      ]),
    })
    expect(f.grupos.map((g) => g.grupo)).toEqual(['Apto 1301', 'Apto 1802'])
    expect(formatarMoeda(f.grupos[0]!.subtotal)).toBe('R$ 2.000,00')
    expect(formatarMoeda(f.grupos[1]!.subtotal)).toBe('R$ 4.000,00')
  })

  it('calcula o preço unitário quando há quantidade', () => {
    const a = apurarServico(servico({ valor: 917460, quantidade: 101.94, unidade: 'm2' }))
    expect(formatarMoeda(a.preco_unitario!)).toBe('R$ 90,00')
  })

  it('não inventa preço unitário sem quantidade', () => {
    expect(apurarServico(servico()).preco_unitario).toBeNull()
  })
})

describe('versões de exibição (spec 4.14)', () => {
  it('o padrão do fechamento sai sem preço unitário e sem BDI', () => {
    expect(VERSAO_PADRAO.mostrar_preco_unitario).toBe(false)
    expect(VERSAO_PADRAO.mostrar_bdi_margem).toBe(false)
  })

  it('a versão do pedreiro não carrega valor nenhum', () => {
    const v = lerVersao({ versao_pedreiro: true, mostrar_preco_unitario: true, mostrar_bdi_margem: true })
    expect(v.versao_pedreiro).toBe(true)
    expect(v.mostrar_preco_unitario).toBe(false)
    expect(v.mostrar_bdi_margem).toBe(false)
  })

  it('completa com o padrão o que não veio gravado', () => {
    const v = lerVersao({ mostrar_preco_unitario: true })
    expect(v.mostrar_preco_unitario).toBe(true)
    expect(v.mostrar_quantidade_unidade).toBe(VERSAO_PADRAO.mostrar_quantidade_unidade)
  })

  it('ignora lixo gravado no banco', () => {
    expect(lerVersao(null)).toEqual(VERSAO_PADRAO)
    expect(lerVersao('nada')).toEqual(VERSAO_PADRAO)
    expect(lerVersao({ mostrar_preco_unitario: 'sim' })).toEqual(VERSAO_PADRAO)
  })

  it('vai e volta pela query string guardando só o que difere do padrão', () => {
    const v = { ...VERSAO_PADRAO, mostrar_preco_unitario: true, mostrar_cnpj_cliente: false }
    const q = versaoParaQuery(v)
    expect(q).toBe('mostrar_preco_unitario=1&mostrar_cnpj_cliente=0')
    expect(versaoDaQuery({ mostrar_preco_unitario: '1', mostrar_cnpj_cliente: '0' })).toEqual(v)
  })

  it('documento de cliente nunca leva BDI nem margem, mesmo se ligarem na tela', () => {
    const interna = { ...VERSAO_PADRAO, mostrar_bdi_margem: true }
    expect(versaoParaCliente(interna).mostrar_bdi_margem).toBe(false)
  })
})

describe('colunas do relatório conforme a versão', () => {
  it('padrão: descrição, quantidade e valor', () => {
    const c = colunasDoRelatorio(VERSAO_PADRAO)
    expect(c.quantidade).toBe(true)
    expect(c.preco_unitario).toBe(false)
    expect(c.valor).toBe(true)
    expect(c.total).toBe(3)
  })

  it('com preço unitário: quatro colunas', () => {
    const c = colunasDoRelatorio({ ...VERSAO_PADRAO, mostrar_preco_unitario: true })
    expect(c.total).toBe(4)
  })

  it('sem quantidade e sem unitário: só descrição e valor', () => {
    const c = colunasDoRelatorio({ ...VERSAO_PADRAO, mostrar_quantidade_unidade: false })
    expect(c.total).toBe(2)
  })

  it('versão do pedreiro: descrição e quantidade, sem nenhuma coluna de valor', () => {
    const c = colunasDoRelatorio(lerVersao({ versao_pedreiro: true, mostrar_preco_unitario: true }))
    expect(c.valor).toBe(false)
    expect(c.preco_unitario).toBe(false)
    expect(c.total).toBe(2)
  })

  it('versão do pedreiro sem quantidade: uma coluna só', () => {
    const c = colunasDoRelatorio(
      lerVersao({ versao_pedreiro: true, mostrar_quantidade_unidade: false }),
    )
    expect(c.total).toBe(1)
  })
})
