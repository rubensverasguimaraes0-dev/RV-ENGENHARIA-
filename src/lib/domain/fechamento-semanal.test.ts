import { describe, expect, it } from 'vitest'
import { calcularFechamentoSemanal } from './fechamento-semanal'
import { ehLancamentoDuplicado, sugestaoParaData, valorDaDiaria } from './lancamento'
import type { Funcionario, LancamentoDiario, Quentinha, Semana } from './tipos'

// Semana 1 de uma obra: segunda 03/08/2026 a sabado 08/08/2026.
const SEGUNDA = '2026-08-03'
const TERCA = '2026-08-04'
const QUARTA = '2026-08-05'
const QUINTA = '2026-08-06'
const SEXTA = '2026-08-07'
const SABADO = '2026-08-08'

function semana(dias_sem_expediente: string[] = []): Semana {
  return {
    id: 's1',
    obra_id: 'o1',
    numero: 1,
    data_inicio: SEGUNDA,
    data_fim: SABADO,
    dias_sem_expediente,
    status: 'aberta',
  }
}

function func(id: string, nome: string, diaria: number, extra: Partial<Funcionario> = {}): Funcionario {
  return {
    id,
    nome,
    tipo: 'funcionario',
    funcao: 'pedreiro',
    valor_diaria: diaria,
    telefone: null,
    chave_pix: `pix-${id}`,
    status: 'ativo',
    data_entrada: null,
    data_saida: null,
    ...extra,
  }
}

let seq = 0
function lanc(
  funcionario_id: string,
  data: string,
  valor_diaria: number,
  extra: Partial<LancamentoDiario> = {},
): LancamentoDiario {
  return {
    id: `l${++seq}`,
    obra_id: 'o1',
    semana_id: 's1',
    funcionario_id,
    data,
    tipo_diaria: 'cheia',
    valor_diaria,
    valor_vale: 0,
    observacao: null,
    ...extra,
  }
}

function quent(data: string, quantidade: number, valor_unitario: number): Quentinha {
  return { id: `q${++seq}`, obra_id: 'o1', semana_id: 's1', data, quantidade, valor_unitario }
}

describe('caso 1 — semana com 3 funcionarios de diarias diferentes', () => {
  // Pedreiro R$ 180,00 | servente R$ 120,00 | ajudante R$ 100,00, 5 dias uteis.
  const funcionarios = [func('f1', 'Antonio', 18000), func('f2', 'Bruno', 12000), func('f3', 'Carlos', 10000)]
  const dias = [SEGUNDA, TERCA, QUARTA, QUINTA, SEXTA]
  const lancamentos = [
    ...dias.map((d) => lanc('f1', d, 18000)),
    ...dias.map((d) => lanc('f2', d, 12000)),
    ...dias.map((d) => lanc('f3', d, 10000, d === SEXTA ? { valor_vale: 5000 } : {})),
  ]
  const quentinhas = dias.map((d) => quent(d, 3, 1800))

  const f = calcularFechamentoSemanal({ semana: semana(), lancamentos, quentinhas, funcionarios })

  it('soma as diarias da semana', () => {
    expect(f.total_mao_obra).toBe(5 * (18000 + 12000 + 10000)) // R$ 2.000,00
  })

  it('soma as quentinhas da semana', () => {
    expect(f.qtd_quentinhas).toBe(15)
    expect(f.total_quentinhas).toBe(15 * 1800) // R$ 270,00
  })

  it('desconta o vale no liquido do funcionario', () => {
    const carlos = f.funcionarios.find((r) => r.nome === 'Carlos')!
    expect(carlos.total_diarias).toBe(50000)
    expect(carlos.total_vales).toBe(5000)
    expect(carlos.liquido).toBe(45000)
  })

  it('fecha o custo da semana como mao de obra + quentinhas', () => {
    expect(f.custo_semana).toBe(200000 + 27000)
  })
})

describe('caso 2 — funcionario sem nenhuma presenca nao aparece', () => {
  const funcionarios = [func('f1', 'Antonio', 18000), func('f2', 'Bruno', 12000)]
  const f = calcularFechamentoSemanal({
    semana: semana(),
    lancamentos: [lanc('f1', SEGUNDA, 18000)],
    quentinhas: [],
    funcionarios,
  })

  it('nao lista quem nao trabalhou no resumo', () => {
    expect(f.funcionarios.map((r) => r.nome)).toEqual(['Antonio'])
  })

  it('nao lista quem nao trabalhou nas abas de dia', () => {
    const todas = f.dias.flatMap((d) => d.linhas.map((l) => l.nome))
    expect(todas).not.toContain('Bruno')
  })
})

describe('caso 3 — sabado', () => {
  it('sugere diaria integral e nenhuma quentinha', () => {
    const s = sugestaoParaData(SABADO)
    expect(s.tipo_diaria).toBe('cheia')
    expect(s.sugerir_quentinha).toBe(false)
  })

  it('em dia util sugere quentinha', () => {
    expect(sugestaoParaData(QUARTA).sugerir_quentinha).toBe(true)
  })

  it('paga a diaria integral no sabado', () => {
    const f = calcularFechamentoSemanal({
      semana: semana(),
      lancamentos: [lanc('f1', SABADO, 18000)],
      quentinhas: [],
      funcionarios: [func('f1', 'Antonio', 18000)],
    })
    const sab = f.dias.find((d) => d.data === SABADO)!
    expect(sab.sabado).toBe(true)
    expect(sab.total_mao_obra).toBe(18000)
    expect(sab.total_quentinhas).toBe(0)
  })
})

describe('caso 4 — meia diaria', () => {
  it('sai pela metade com o percentual padrao', () => {
    expect(valorDaDiaria('meia', 18000, 0.5)).toBe(9000)
  })

  it('aceita percentual diferente vindo de parametros', () => {
    expect(valorDaDiaria('meia', 18000, 0.6)).toBe(10800)
  })

  it('soma a metade no fechamento', () => {
    const f = calcularFechamentoSemanal({
      semana: semana(),
      lancamentos: [lanc('f1', SEGUNDA, 9000, { tipo_diaria: 'meia' })],
      quentinhas: [],
      funcionarios: [func('f1', 'Antonio', 18000)],
    })
    expect(f.total_mao_obra).toBe(9000)
    expect(f.funcionarios[0]!.dias_meios).toBe(1)
  })
})

describe('caso 5 — 4 quentinhas num dia com 3 presentes', () => {
  const f = calcularFechamentoSemanal({
    semana: semana(),
    lancamentos: [lanc('f1', SEGUNDA, 18000), lanc('f2', SEGUNDA, 12000), lanc('f3', SEGUNDA, 10000)],
    quentinhas: [quent(SEGUNDA, 4, 1800)],
    funcionarios: [func('f1', 'A', 18000), func('f2', 'B', 12000), func('f3', 'C', 10000)],
  })

  it('aceita a diferenca entre presentes e quentinhas', () => {
    const dia = f.dias.find((d) => d.data === SEGUNDA)!
    expect(dia.qtd_presentes).toBe(3)
    expect(dia.qtd_quentinhas).toBe(4)
    expect(dia.total_quentinhas).toBe(7200)
  })
})

describe('caso 6 — quentinhas em duas faixas de valor', () => {
  const f = calcularFechamentoSemanal({
    semana: semana(),
    lancamentos: [lanc('f1', SEGUNDA, 18000)],
    quentinhas: [
      quent(SEGUNDA, 3, 1500),
      quent(TERCA, 3, 1500),
      quent(QUARTA, 3, 1800),
      quent(QUINTA, 3, 1800),
      quent(SEXTA, 3, 1800),
    ],
    funcionarios: [func('f1', 'Antonio', 18000)],
  })

  it('separa as faixas com quantidade e custo de cada uma', () => {
    expect(f.faixas_quentinha).toEqual([
      { valor_unitario: 1500, quantidade: 6, total: 9000 },
      { valor_unitario: 1800, quantidade: 9, total: 16200 },
    ])
    expect(f.total_quentinhas).toBe(25200)
  })
})

describe('caso 7 — semana encerrada na quinta', () => {
  const f = calcularFechamentoSemanal({
    semana: semana([SEXTA, SABADO]),
    lancamentos: [lanc('f1', QUINTA, 18000), lanc('f1', SEXTA, 18000), lanc('f1', SABADO, 18000)],
    quentinhas: [quent(SEXTA, 3, 1800)],
    funcionarios: [func('f1', 'Antonio', 18000)],
  })

  it('nao inclui sexta nem sabado nas abas', () => {
    expect(f.dias.map((d) => d.data)).toEqual([SEGUNDA, TERCA, QUARTA, QUINTA])
  })

  it('ignora lancamentos e quentinhas dos dias sem expediente', () => {
    expect(f.total_mao_obra).toBe(18000)
    expect(f.total_quentinhas).toBe(0)
    expect(f.funcionarios[0]!.dias_trabalhados).toBe(1)
  })
})

describe('caso 8 — parceiro presente sem diaria', () => {
  const f = calcularFechamentoSemanal({
    semana: semana(),
    lancamentos: [lanc('p1', SEGUNDA, 0, { tipo_diaria: 'sem_diaria' })],
    quentinhas: [quent(SEGUNDA, 1, 1800)],
    funcionarios: [func('p1', 'Rubens', 0, { tipo: 'parceiro', funcao: 'engenheiro' })],
  })

  it('aparece no dia e soma R$ 0,00 de mao de obra', () => {
    const dia = f.dias.find((d) => d.data === SEGUNDA)!
    expect(dia.qtd_presentes).toBe(1)
    expect(dia.total_mao_obra).toBe(0)
    expect(f.funcionarios[0]!.tipo).toBe('parceiro')
    expect(f.funcionarios[0]!.total_diarias).toBe(0)
    expect(f.funcionarios[0]!.dias_sem_diaria).toBe(1)
  })

  it('consome quentinha mesmo sem diaria', () => {
    expect(f.total_quentinhas).toBe(1800)
  })
})

describe('caso 9 — recibo individual do funcionario', () => {
  const f = calcularFechamentoSemanal({
    semana: semana(),
    lancamentos: [
      lanc('f1', SEGUNDA, 18000),
      lanc('f1', TERCA, 18000),
      lanc('f1', QUARTA, 9000, { tipo_diaria: 'meia' }),
      lanc('f1', QUINTA, 18000, { valor_vale: 10000 }),
    ],
    quentinhas: [],
    funcionarios: [func('f1', 'Antonio', 18000)],
  })

  it('confere dias, vales e liquido', () => {
    const r = f.funcionarios[0]!
    expect(r.dias_trabalhados).toBe(4)
    expect(r.dias_cheios).toBe(3)
    expect(r.dias_meios).toBe(1)
    expect(r.total_diarias).toBe(63000) // 3 x 180 + 1 x 90
    expect(r.total_vales).toBe(10000)
    expect(r.liquido).toBe(53000)
    expect(r.chave_pix).toBe('pix-f1')
  })
})

describe('regra — lancamento duplicado', () => {
  const existentes = [{ id: 'l1', obra_id: 'o1', funcionario_id: 'f1', data: SEGUNDA }]

  it('bloqueia o mesmo funcionario na mesma obra e data', () => {
    expect(ehLancamentoDuplicado(existentes, { obra_id: 'o1', funcionario_id: 'f1', data: SEGUNDA })).toBe(true)
  })

  it('libera outra data, outra obra ou outro funcionario', () => {
    expect(ehLancamentoDuplicado(existentes, { obra_id: 'o1', funcionario_id: 'f1', data: TERCA })).toBe(false)
    expect(ehLancamentoDuplicado(existentes, { obra_id: 'o2', funcionario_id: 'f1', data: SEGUNDA })).toBe(false)
    expect(ehLancamentoDuplicado(existentes, { obra_id: 'o1', funcionario_id: 'f2', data: SEGUNDA })).toBe(false)
  })

  it('nao acusa duplicidade ao editar o proprio lancamento', () => {
    expect(
      ehLancamentoDuplicado(existentes, { id: 'l1', obra_id: 'o1', funcionario_id: 'f1', data: SEGUNDA }),
    ).toBe(false)
  })
})
