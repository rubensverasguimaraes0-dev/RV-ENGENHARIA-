import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { gerarPlanilhaSemanal } from './planilha-semanal'
import { calcularFechamentoSemanal } from '@/lib/domain/fechamento-semanal'
import type { Funcionario, LancamentoDiario, Quentinha, Semana } from '@/lib/domain/tipos'
import type { DadosEmpresa } from '@/lib/parametros'

const EMPRESA: DadosEmpresa = {
  nome: 'RV Engenharia',
  endereco: 'Av. Zequinha Freire, 3531 — Teresina/PI',
  telefone: '(86) 99437-9883',
  email: 'rvengenhariathe@gmail.com',
  instagram: '@rvengenhariathe',
  logo_url: '',
  responsavel: 'Rubens Veras Guimaraes',
  responsavel_titulo: 'Eng. Civil',
  crea: 'CREA-PI 35900',
}

const semana: Semana = {
  id: 's1',
  obra_id: 'o1',
  numero: 3,
  data_inicio: '2026-08-03',
  data_fim: '2026-08-08',
  dias_sem_expediente: ['2026-08-08'],
  status: 'fechada',
}

const funcionarios: Funcionario[] = [
  {
    id: 'f1',
    nome: 'Antonio',
    tipo: 'funcionario',
    funcao: 'pedreiro',
    valor_diaria: 18000,
    telefone: null,
    chave_pix: 'pix-antonio',
    status: 'ativo',
    data_entrada: null,
    data_saida: null,
  },
  {
    id: 'f2',
    nome: 'Bruno',
    tipo: 'funcionario',
    funcao: 'servente',
    valor_diaria: 12000,
    telefone: null,
    chave_pix: null,
    status: 'ativo',
    data_entrada: null,
    data_saida: null,
  },
]

const dias = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07']
let n = 0
const lancamentos: LancamentoDiario[] = dias.flatMap((data) => [
  {
    id: `l${++n}`,
    obra_id: 'o1',
    semana_id: 's1',
    funcionario_id: 'f1',
    data,
    tipo_diaria: 'cheia',
    valor_diaria: 18000,
    valor_vale: data === '2026-08-07' ? 5000 : 0,
    observacao: null,
  },
  {
    id: `l${++n}`,
    obra_id: 'o1',
    semana_id: 's1',
    funcionario_id: 'f2',
    data,
    tipo_diaria: 'cheia',
    valor_diaria: 12000,
    valor_vale: 0,
    observacao: null,
  },
])

const quentinhas: Quentinha[] = [
  { id: 'q1', obra_id: 'o1', semana_id: 's1', data: '2026-08-03', quantidade: 2, valor_unitario: 1500 },
  { id: 'q2', obra_id: 'o1', semana_id: 's1', data: '2026-08-04', quantidade: 2, valor_unitario: 1500 },
  { id: 'q3', obra_id: 'o1', semana_id: 's1', data: '2026-08-05', quantidade: 3, valor_unitario: 1800 },
  { id: 'q4', obra_id: 'o1', semana_id: 's1', data: '2026-08-06', quantidade: 2, valor_unitario: 1800 },
  { id: 'q5', obra_id: 'o1', semana_id: 's1', data: '2026-08-07', quantidade: 2, valor_unitario: 1800 },
]

const fechamento = calcularFechamentoSemanal({ semana, lancamentos, quentinhas, funcionarios })

async function abrirPlanilha() {
  const buffer = await gerarPlanilhaSemanal({
    fechamento,
    empresa: EMPRESA,
    obraNome: 'Reforma Center Paes',
    clienteNome: 'Center Paes',
  })
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as unknown as ArrayBuffer)
  return wb
}

describe('planilha do fechamento semanal', () => {
  it('gera uma aba por dia trabalhado mais o resumo', async () => {
    const wb = await abrirPlanilha()
    const nomes = wb.worksheets.map((w) => w.name)
    // sabado 08/08 esta marcado como sem expediente: nao vira aba
    expect(nomes).toHaveLength(6)
    expect(nomes[5]).toBe('Resumo da semana')
    expect(nomes[0]).toContain('Segunda')
    expect(nomes.some((x) => x.includes('Sabado'))).toBe(false)
  })

  it('escreve os totais como formula, nunca como numero digitado', async () => {
    const wb = await abrirPlanilha()
    const resumo = wb.getWorksheet('Resumo da semana')!

    const formulas: string[] = []
    resumo.eachRow((row) =>
      row.eachCell((cell) => {
        if (cell.type === ExcelJS.ValueType.Formula) {
          formulas.push((cell.value as ExcelJS.CellFormulaValue).formula)
        }
      }),
    )

    expect(formulas.some((f) => f.startsWith('SUM('))).toBe(true)
    // liquido de cada funcionario = diarias - vales
    expect(formulas).toContain('D7-E7')
    // custo da semana = mao de obra + quentinhas, somando duas celulas de total
    expect(formulas.some((f) => /^B\d+\+B\d+$/.test(f))).toBe(true)
  })

  it('leva os valores em reais, com formato de moeda', async () => {
    const wb = await abrirPlanilha()
    const resumo = wb.getWorksheet('Resumo da semana')!
    // linha 1 titulo, 2 subtitulo, 4 faixa de secao, 5 cabecalho, 6 primeiro funcionario
    const linha = resumo.getRow(6)
    expect(linha.getCell(1).value).toBe('Antonio')
    expect(linha.getCell(3).value).toBe(5)
    expect(linha.getCell(4).value).toBe(900)
    expect(linha.getCell(4).numFmt).toBe('R$ #,##0.00')
    expect(linha.getCell(5).value).toBe(50)
  })

  it('separa as faixas de quentinha na aba de resumo', async () => {
    const wb = await abrirPlanilha()
    const resumo = wb.getWorksheet('Resumo da semana')!

    const valoresUnitarios: number[] = []
    resumo.eachRow((row) => {
      const a = row.getCell(1).value
      const b = row.getCell(2).value
      if (typeof a === 'number' && typeof b === 'number') valoresUnitarios.push(a)
    })
    expect(valoresUnitarios).toEqual([15, 18])
  })

  it('registra os dias sem expediente na aba de resumo', async () => {
    const wb = await abrirPlanilha()
    const resumo = wb.getWorksheet('Resumo da semana')!
    let achou = false
    resumo.eachRow((row) => {
      const v = row.getCell(1).value
      if (typeof v === 'string' && v.startsWith('Sem expediente')) {
        achou = true
        expect(v).toContain('08/08/2026')
      }
    })
    expect(achou).toBe(true)
  })

  it('a aba do dia soma presença e quentinhas do próprio dia', async () => {
    const wb = await abrirPlanilha()
    const segunda = wb.worksheets[0]!
    const formulas: string[] = []
    segunda.eachRow((row) =>
      row.eachCell((cell) => {
        if (cell.type === ExcelJS.ValueType.Formula) {
          formulas.push((cell.value as ExcelJS.CellFormulaValue).formula)
        }
      }),
    )
    // custo da quentinha = valor unitario x quantidade
    expect(formulas.some((f) => /^A\d+\*B\d+$/.test(f))).toBe(true)
    // total do dia = total de mao de obra + total de quentinhas
    expect(formulas.some((f) => /^D\d+\+C\d+$/.test(f))).toBe(true)
  })
})
