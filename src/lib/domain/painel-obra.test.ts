import { describe, expect, it } from 'vitest'
import { evolucaoDaObra, resumirEquipe } from './painel-obra'
import type { Funcionario, LancamentoDiario, Pagamento, Quentinha, Semana } from './tipos'

function func(id: string, nome: string, extra: Partial<Funcionario> = {}): Funcionario {
  return {
    id, nome, tipo: 'funcionario', funcao: 'Servente', valor_diaria: 9000,
    telefone: null, chave_pix: null, status: 'ativo',
    data_entrada: null, data_saida: null, ...extra,
  }
}

function lanc(funcionario_id: string, data: string, valor: number, extra: Partial<LancamentoDiario> = {}): LancamentoDiario {
  return {
    id: `${funcionario_id}-${data}`, obra_id: 'o1', semana_id: null, funcionario_id,
    data, tipo_diaria: 'cheia', valor_diaria: valor, valor_vale: 0, observacao: null, ...extra,
  }
}

function semana(numero: number, inicio: string, fim: string): Semana {
  return {
    id: `s${numero}`, obra_id: 'o1', numero, data_inicio: inicio, data_fim: fim,
    dias_sem_expediente: [], status: 'fechada',
  }
}

function parcela(id: string, extra: Partial<Pagamento> = {}): Pagamento {
  return {
    id, obra_id: 'o1', numero_parcela: 1, valor_previsto: 0, data_prevista: null,
    valor_recebido: null, data_recebimento: null, forma_pagamento: null,
    comprovante_url: null, valor_outro_contrato: 0, observacao: null,
    status: 'prevista', balao: false, ...extra,
  }
}

describe('equipe da obra — quem custou quanto', () => {
  const funcionarios = [
    func('f1', 'Thiago', { funcao: 'Pedreiro', valor_diaria: 20000 }),
    func('f2', 'Iago'),
  ]
  const lancamentos = [
    lanc('f1', '2026-07-20', 20000),
    lanc('f1', '2026-07-21', 20000),
    lanc('f2', '2026-08-12', 4500, { tipo_diaria: 'meia' }),
    lanc('f2', '2026-08-13', 9000),
  ]

  it('conta meia diaria como 0,5, como na planilha', () => {
    const iago = resumirEquipe(lancamentos, funcionarios).find((l) => l.nome === 'Iago')
    expect(iago?.diarias).toBe(1.5)
    expect(iago?.dias_meios).toBe(1)
    expect(iago?.total).toBe(13500)
  })

  it('ordena por custo, do maior para o menor', () => {
    expect(resumirEquipe(lancamentos, funcionarios).map((l) => l.nome)).toEqual(['Thiago', 'Iago'])
  })

  it('guarda a primeira e a ultima presenca de cada um', () => {
    const thiago = resumirEquipe(lancamentos, funcionarios)[0]
    expect(thiago?.primeira).toBe('2026-07-20')
    expect(thiago?.ultima).toBe('2026-07-21')
  })

  it('a fracao de cada um soma 100%', () => {
    const soma = resumirEquipe(lancamentos, funcionarios).reduce((s, l) => s + l.fracao, 0)
    expect(soma).toBeCloseTo(1, 10)
  })

  it('dia sem diaria aparece contado, mas nao custa', () => {
    const linhas = resumirEquipe(
      [lanc('f1', '2026-07-20', 0, { tipo_diaria: 'sem_diaria' })],
      funcionarios,
    )
    expect(linhas[0]?.dias_sem_diaria).toBe(1)
    expect(linhas[0]?.diarias).toBe(0)
    expect(linhas[0]?.total).toBe(0)
  })

  it('funcionario apagado do cadastro nao apaga o custo que ele gerou', () => {
    const linhas = resumirEquipe([lanc('sumiu', '2026-07-20', 9000)], [])
    expect(linhas[0]?.nome).toBe('Funcionário removido')
    expect(linhas[0]?.total).toBe(9000)
  })

  it('obra sem lancamento nao gera linha nenhuma', () => {
    expect(resumirEquipe([], funcionarios)).toEqual([])
  })
})

describe('evolucao da obra semana a semana', () => {
  const semanas = [semana(2, '2026-07-27', '2026-08-01'), semana(1, '2026-07-20', '2026-07-25')]
  const lancamentos = [lanc('f1', '2026-07-20', 20000), lanc('f1', '2026-07-27', 10000)]
  const quentinhas: Quentinha[] = [
    { id: 'q1', obra_id: 'o1', semana_id: null, data: '2026-07-20', quantidade: 2, valor_unitario: 2200 },
  ]
  const pagamentos = [
    parcela('p1', { valor_recebido: 500000, data_recebimento: '2026-07-23' }),
    parcela('p2', { valor_recebido: 500000, data_recebimento: '2026-08-01' }),
  ]

  const pontos = evolucaoDaObra({ semanas, lancamentos, quentinhas, pagamentos })

  it('devolve as semanas em ordem cronologica, nao na ordem recebida', () => {
    expect(pontos.map((p) => p.semana)).toEqual([1, 2])
  })

  it('separa mao de obra de alimentacao dentro da semana', () => {
    expect(pontos[0]?.mao_obra).toBe(20000)
    expect(pontos[0]?.alimentacao).toBe(4400)
    expect(pontos[0]?.custo).toBe(24400)
  })

  it('acumula o custo de uma semana para a outra', () => {
    expect(pontos[1]?.custo).toBe(10000)
    expect(pontos[1]?.custo_acumulado).toBe(34400)
  })

  it('acumula o recebido por data de pagamento, nao por semana', () => {
    expect(pontos[0]?.recebido_acumulado).toBe(500000)
    expect(pontos[1]?.recebido_acumulado).toBe(1000000)
  })

  it('desconta do recebido a parte que e de outro contrato', () => {
    const p = evolucaoDaObra({
      semanas: [semana(1, '2026-07-20', '2026-07-25')],
      lancamentos: [],
      quentinhas: [],
      pagamentos: [parcela('p', { valor_recebido: 500000, valor_outro_contrato: 200000, data_recebimento: '2026-07-22' })],
    })
    expect(p[0]?.recebido_acumulado).toBe(300000)
  })

  it('parcela ainda nao recebida nao entra no acumulado', () => {
    const p = evolucaoDaObra({
      semanas: [semana(1, '2026-07-20', '2026-07-25')],
      lancamentos: [], quentinhas: [],
      pagamentos: [parcela('p', { valor_previsto: 500000, data_prevista: '2026-07-23' })],
    })
    expect(p[0]?.recebido_acumulado).toBe(0)
  })

  it('lancamento fora do intervalo das semanas nao e contado duas vezes nem some', () => {
    const p = evolucaoDaObra({
      semanas: [semana(1, '2026-07-20', '2026-07-25')],
      lancamentos: [lanc('f1', '2026-07-26', 9000)],
      quentinhas: [], pagamentos: [],
    })
    expect(p[0]?.custo).toBe(0)
  })

  it('obra sem semana devolve serie vazia', () => {
    expect(evolucaoDaObra({ semanas: [], lancamentos, quentinhas, pagamentos })).toEqual([])
  })
})
