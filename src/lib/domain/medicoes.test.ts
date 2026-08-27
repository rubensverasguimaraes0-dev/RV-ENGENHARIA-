import { describe, expect, it } from 'vitest'
import {
  apurarServicos,
  apurarTerceiros,
  medicoesPorLocal,
  totalizarMedicoes,
  totalizarTerceiros,
  type Medicao,
  type ServicoMedicao,
  type ServicoTerceiro,
} from './medicoes'
import { formatarMoeda } from '@/lib/format'

function servico(id: string, extra: Partial<ServicoMedicao> = {}): ServicoMedicao {
  return {
    id,
    obra_id: 'o1',
    descricao: 'Forro em gesso acartonado',
    unidade: 'm2',
    quantidade_contratada: 101.94,
    custo_unitario: 6674, // R$ 66,74/m2
    preco_venda_unitario: 9000, // R$ 90,00/m2
    ...extra,
  }
}

let n = 0
function medicao(servico_id: string, quantidade: number, extra: Partial<Medicao> = {}): Medicao {
  return {
    id: `m${++n}`,
    obra_id: 'o1',
    servico_id,
    local_id: null,
    data: '2026-08-05',
    quantidade,
    observacao: null,
    ...extra,
  }
}

describe('caso 23 — medição de forro de 101,94 m² a R$ 90,00/m²', () => {
  const servicos = [servico('s1')]
  const [apurado] = apurarServicos(servicos, [medicao('s1', 101.94)])

  it('confere o valor de venda de R$ 9.174,60', () => {
    expect(apurado!.valor_executado).toBe(917460)
    expect(formatarMoeda(apurado!.valor_executado)).toBe('R$ 9.174,60')
  })

  it('mantém o custo apurado só na apuração interna', () => {
    expect(formatarMoeda(apurado!.custo_executado)).toBe('R$ 6.803,48')
    expect(formatarMoeda(apurado!.margem)).toBe('R$ 2.371,12')
    expect(apurado!.margem_percentual).toBeCloseTo(0.2584, 4)
  })

  it('fecha 100% do contratado', () => {
    expect(apurado!.percentual_executado).toBeCloseTo(1, 6)
    expect(apurado!.saldo_a_executar).toBe(0)
  })
})

describe('sanca cobrada à parte, por metro linear', () => {
  const servicos = [
    servico('s2', {
      descricao: 'Sanca',
      unidade: 'm',
      quantidade_contratada: 18,
      custo_unitario: null,
      preco_venda_unitario: 9000,
    }),
  ]

  it('R$ 90,00/m linear x 18,00 m = R$ 1.620,00', () => {
    const [a] = apurarServicos(servicos, [medicao('s2', 18)])
    expect(formatarMoeda(a!.valor_executado)).toBe('R$ 1.620,00')
  })

  it('sem custo cadastrado, a margem é o próprio valor', () => {
    const [a] = apurarServicos(servicos, [medicao('s2', 18)])
    expect(a!.custo_executado).toBe(0)
    expect(a!.margem).toBe(162000)
  })
})

describe('execução parcial e medições em várias datas', () => {
  const servicos = [servico('s1')]
  const medicoes = [medicao('s1', 40), medicao('s1', 30.5, { data: '2026-08-07' })]
  const [a] = apurarServicos(servicos, medicoes)

  it('acumula as medições lançadas', () => {
    expect(a!.quantidade_executada).toBe(70.5)
  })

  it('mostra o saldo a executar e o percentual', () => {
    expect(a!.saldo_a_executar).toBe(31.44)
    expect(a!.percentual_executado).toBeCloseTo(0.6916, 4)
  })

  it('cobra apenas o executado, não o contratado', () => {
    expect(formatarMoeda(a!.valor_executado)).toBe('R$ 6.345,00')
    expect(formatarMoeda(a!.valor_contratado!)).toBe('R$ 9.174,60')
  })

  it('não acumula erro de ponto flutuante na quantidade', () => {
    const [x] = apurarServicos(
      [servico('s9', { quantidade_contratada: 0.3 })],
      [medicao('s9', 0.1), medicao('s9', 0.1)],
    )
    expect(x!.quantidade_executada).toBe(0.2)
    expect(x!.saldo_a_executar).toBe(0.1)
  })
})

describe('serviço sem quantidade contratada', () => {
  it('não inventa saldo nem percentual', () => {
    const [a] = apurarServicos(
      [servico('s3', { quantidade_contratada: null })],
      [medicao('s3', 12)],
    )
    expect(a!.saldo_a_executar).toBeNull()
    expect(a!.percentual_executado).toBeNull()
    expect(a!.valor_contratado).toBeNull()
  })
})

describe('totais e agrupamento por local', () => {
  const servicos = [servico('s1'), servico('s2', { descricao: 'Sanca', preco_venda_unitario: 9000, custo_unitario: null, quantidade_contratada: 18 })]
  const medicoes = [
    medicao('s1', 60, { local_id: 'apto1802' }),
    medicao('s1', 41.94, { local_id: 'apto1301' }),
    medicao('s2', 18, { local_id: 'apto1802' }),
  ]
  const apurados = apurarServicos(servicos, medicoes)

  it('soma o executado dos dois serviços', () => {
    const t = totalizarMedicoes(apurados)
    expect(formatarMoeda(t.valor_executado)).toBe('R$ 10.794,60') // 9.174,60 + 1.620,00
  })

  it('separa o valor por local para o relatório', () => {
    const porLocal = medicoesPorLocal(apurados, medicoes)
    expect(formatarMoeda(porLocal.find((l) => l.local_id === 'apto1802')!.valor)).toBe('R$ 7.020,00')
    expect(formatarMoeda(porLocal.find((l) => l.local_id === 'apto1301')!.valor)).toBe('R$ 3.774,60')
  })
})

describe('serviços de terceiros', () => {
  // Caso real: instalador de forro a R$ 18,00 por m2 executado.
  const servicos: ServicoTerceiro[] = [
    {
      id: 't1',
      obra_id: 'o1',
      terceiro_id: 'inst',
      descricao: 'Instalação de forro — R$ 18,00/m²',
      quantidade: 101.94,
      valor_combinado: 183492, // 101,94 x R$ 18,00
      valor_pago: 100000,
      comprovante_url: null,
    },
  ]

  it('mostra o saldo a pagar', () => {
    const [a] = apurarTerceiros(servicos)
    expect(formatarMoeda(a!.valor_combinado)).toBe('R$ 1.834,92')
    expect(formatarMoeda(a!.saldo)).toBe('R$ 834,92')
    expect(a!.quitado).toBe(false)
  })

  it('marca como quitado quando o pago alcança o combinado', () => {
    const [a] = apurarTerceiros([{ ...servicos[0]!, valor_pago: 183492 }])
    expect(a!.quitado).toBe(true)
    expect(a!.saldo).toBe(0)
  })

  it('totaliza combinado, pago e saldo', () => {
    const t = totalizarTerceiros(apurarTerceiros(servicos))
    expect(t.combinado).toBe(183492)
    expect(t.pago).toBe(100000)
    expect(t.saldo).toBe(83492)
  })
})
