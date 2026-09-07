import { describe, expect, it } from 'vitest'
import { montarRelatorioMaoDeObra } from './mao-de-obra'
import type { Funcionario, LancamentoDiario, Quentinha } from './tipos'

/**
 * Os numeros deste arquivo sao os do
 * Relatorio_Mao_de_Obra_Piso_Industrial_REVEST.pdf, o documento aprovado.
 * Se algum deixar de bater, o relatorio do app deixou de ser o do Rubens.
 */

const AJUDANTES: [string, string, number][] = [
  ['gervasio', 'GERVÁSIO', 12000],
  ['iago', 'IAGO', 12000],
  ['amigo', 'AMIGO DO IAGO', 10000],
  ['maximo', 'MÁXIMO', 12000],
  ['danilo', 'DANILO', 12000],
]

const funcionarios: Funcionario[] = [
  ...AJUDANTES.map(([id, nome, diaria]) => pessoa(id, nome, 'funcionario', 'Ajudante', diaria)),
  pessoa('rubens', 'RUBENS', 'parceiro', 'Engenheiro', 0),
  pessoa('thiago', 'THIAGO', 'parceiro', 'Pedreiro', 0),
]

function pessoa(
  id: string,
  nome: string,
  tipo: 'funcionario' | 'parceiro',
  funcao: string,
  valor_diaria: number,
): Funcionario {
  return {
    id,
    nome,
    tipo,
    funcao,
    valor_diaria,
    telefone: null,
    chave_pix: null,
    status: 'ativo',
    data_entrada: null,
    data_saida: null,
  }
}

let n = 0
function lancar(data: string, funcionario_id: string, valor: number): LancamentoDiario {
  return {
    id: `l${++n}`,
    obra_id: 'o1',
    semana_id: null,
    funcionario_id,
    data,
    tipo_diaria: valor > 0 ? 'cheia' : 'sem_diaria',
    valor_diaria: valor,
    valor_vale: 0,
    observacao: null,
  } as LancamentoDiario
}

const lancamentos: LancamentoDiario[] = [
  // Sexta 21/08 — tres ajudantes
  lancar('2026-08-21', 'gervasio', 12000),
  lancar('2026-08-21', 'iago', 12000),
  lancar('2026-08-21', 'amigo', 10000),
  lancar('2026-08-21', 'rubens', 0),
  lancar('2026-08-21', 'thiago', 0),
  // Sabado 22/08 — quatro ajudantes
  lancar('2026-08-22', 'gervasio', 12000),
  lancar('2026-08-22', 'iago', 12000),
  lancar('2026-08-22', 'maximo', 12000),
  lancar('2026-08-22', 'danilo', 12000),
  lancar('2026-08-22', 'rubens', 0),
  lancar('2026-08-22', 'thiago', 0),
]

const quentinhas: Quentinha[] = [
  { id: 'q1', obra_id: 'o1', semana_id: null, data: '2026-08-21', quantidade: 5, valor_unitario: 1800 },
  { id: 'q2', obra_id: 'o1', semana_id: null, data: '2026-08-22', quantidade: 6, valor_unitario: 1800 },
] as Quentinha[]

const VERBA = 350000

function montar(verba = VERBA) {
  return montarRelatorioMaoDeObra({ lancamentos, quentinhas, funcionarios, verba })
}

describe('relatório interno de mão de obra (obra da Revest)', () => {
  it('fecha os dois dias nos valores do documento aprovado', () => {
    const r = montar()
    expect(r.dias).toHaveLength(2)

    const [sexta, sabado] = r.dias
    expect(sexta!.custo_diarias).toBe(34000)
    expect(sexta!.custo_alimentacao).toBe(9000) // 5 x R$ 18,00
    expect(sexta!.total_dia).toBe(43000) // R$ 430,00

    expect(sabado!.custo_diarias).toBe(48000)
    expect(sabado!.custo_alimentacao).toBe(10800) // 6 x R$ 18,00
    expect(sabado!.total_dia).toBe(58800) // R$ 588,00
  })

  it('soma R$ 1.018,00 de custo realizado', () => {
    const r = montar()
    expect(r.total_diarias).toBe(82000)
    expect(r.total_alimentacao).toBe(19800)
    expect(r.total_pago).toBe(101800)
  })

  it('divide o saldo da verba entre os dois executores, R$ 1.241,00 para cada', () => {
    const r = montar()
    expect(r.saldo).toBe(248200) // R$ 3.500,00 - R$ 1.018,00
    expect(r.executores.map((e) => e.nome).sort()).toEqual(['RUBENS', 'THIAGO'])
    expect(r.parte_de_cada_executor).toBe(124100)
    for (const e of r.executores) expect(e.total).toBe(124100)
  })

  it('o total geral fecha na verba do orçamento', () => {
    expect(montar().total_geral).toBe(VERBA)
  })

  it('o executor aparece no dia, mas sem diária e sem valor', () => {
    const r = montar()
    const rubens = r.dias[0]!.pessoas.find((p) => p.nome === 'RUBENS')!
    expect(rubens.executor).toBe(true)
    expect(rubens.diarias).toBe(0)
    expect(rubens.valor).toBe(0)
    expect(rubens.funcao).toBe('Execução / RV Engenharia')
  })

  it('lista os ajudantes primeiro e os executores no fim', () => {
    const nomes = montar().dias[0]!.pessoas.map((p) => p.nome)
    expect(nomes).toEqual(['AMIGO DO IAGO', 'GERVÁSIO', 'IAGO', 'RUBENS', 'THIAGO'])
  })

  it('o resumo por pessoa repete os totais do documento', () => {
    const porNome = new Map(montar().por_pessoa.map((p) => [p.nome, p.total]))
    expect(porNome.get('GERVÁSIO')).toBe(24000)
    expect(porNome.get('IAGO')).toBe(24000)
    expect(porNome.get('AMIGO DO IAGO')).toBe(10000)
    expect(porNome.get('MÁXIMO')).toBe(12000)
    expect(porNome.get('DANILO')).toBe(12000)
    // os executores nao entram neste bloco: eles tem o proprio
    expect(porNome.has('RUBENS')).toBe(false)
  })

  it('sem verba informada, não inventa saldo para dividir', () => {
    const r = montar(0)
    expect(r.saldo).toBe(0)
    expect(r.parte_de_cada_executor).toBe(0)
    expect(r.total_geral).toBe(r.total_pago)
  })

  it('verba menor que o gasto não vira dívida do executor', () => {
    const r = montar(50000) // R$ 500,00 para um gasto de R$ 1.018,00
    expect(r.saldo).toBe(0)
    expect(r.parte_de_cada_executor).toBe(0)
    expect(r.total_geral).toBe(101800)
  })
})
