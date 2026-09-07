import { afterEach, describe, expect, it, vi } from 'vitest'
import ExcelJS from 'exceljs'
import { gerarPlanilhaSemanal } from './planilha-semanal'
import { calcularFechamentoSemanal } from '@/lib/domain/fechamento-semanal'
import type { Funcionario, LancamentoDiario, Quentinha, Semana } from '@/lib/domain/tipos'
import type { DadosEmpresa } from '@/lib/parametros'
import { pngFalso } from './logo-planilha.test'

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
  {
    id: 'f3',
    nome: 'Carlos',
    tipo: 'funcionario',
    funcao: 'ajudante',
    valor_diaria: 10000,
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

// So na segunda — nos outros dias ele tem de sair com traco.
lancamentos.push({
  id: 'l-carlos',
  obra_id: 'o1',
  semana_id: 's1',
  funcionario_id: 'f3',
  data: '2026-08-03',
  tipo_diaria: 'meia',
  valor_diaria: 5000,
  valor_vale: 0,
  observacao: 'entrou depois do almoço',
})

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
  it('sai com Parâmetros, uma aba por dia e o Resumo Semanal', async () => {
    const wb = await abrirPlanilha()
    const nomes = wb.worksheets.map((w) => w.name)
    // sabado 08/08 esta marcado como sem expediente: nao vira aba
    expect(nomes).toHaveLength(7)
    expect(nomes[0]).toBe('Parâmetros')
    expect(nomes[1]).toContain('Segunda')
    expect(nomes[6]).toBe('Resumo Semanal')
    expect(nomes.some((x) => x.includes('Sabado'))).toBe(false)
  })

  it('usa o formato de moeda brasileiro, e não o americano', async () => {
    const wb = await abrirPlanilha()
    const formatos = new Set<string>()
    for (const ws of wb.worksheets) {
      ws.eachRow((row) =>
        row.eachCell((cell) => {
          if (cell.numFmt?.includes('R$')) formatos.add(cell.numFmt)
        }),
      )
    }
    expect(formatos.size).toBeGreaterThan(0)
    // Sem o prefixo [$-416] o conversor para PDF escreve "R$ 67,029.64".
    for (const f of formatos) expect(f.startsWith('[$-416]')).toBe(true)
  })

  it('escreve tudo em Arial e desliga as linhas de grade', async () => {
    const wb = await abrirPlanilha()
    for (const ws of wb.worksheets) {
      expect(ws.views[0]?.showGridLines).toBe(false)
      ws.eachRow((row) =>
        row.eachCell((cell) => {
          if (cell.value !== null) expect(cell.font?.name).toBe('Arial')
        }),
      )
    }
  })

  it('a aba do dia lista toda a equipe da semana, com traço em quem faltou', async () => {
    const wb = await abrirPlanilha()
    const terca = wb.getWorksheet('Terca 04-08') ?? wb.worksheets[2]!

    const porNome = new Map<string, ExcelJS.Row>()
    terca.eachRow((row) => {
      const nome = row.getCell(1).value
      if (typeof nome === 'string') porNome.set(nome, row)
    })

    // Antonio trabalhou: presenca 1 e valor do dia preenchidos.
    expect(porNome.get('Antonio')!.getCell(4).value).toBe(1)
    expect(porNome.get('Antonio')!.getCell(5).value).toBe(180)
    // Carlos so trabalhou na segunda: aparece na lista, sem presenca nem valor.
    expect(porNome.has('Carlos')).toBe(true)
    expect(porNome.get('Carlos')!.getCell(4).value).toBeNull()
    expect(porNome.get('Carlos')!.getCell(5).value).toBeNull()
    // ...mas a diaria de cadastro continua a vista
    expect(porNome.get('Carlos')!.getCell(3).value).toBe(100)
  })

  it('a meia diária aparece como 0,5 na coluna de presença', async () => {
    const wb = await abrirPlanilha()
    const segunda = wb.worksheets[1]!
    let carlos: ExcelJS.Row | undefined
    segunda.eachRow((row) => {
      if (row.getCell(1).value === 'Carlos') carlos = row
    })
    expect(carlos!.getCell(4).value).toBe(0.5)
    expect(carlos!.getCell(5).value).toBe(50)
  })

  it('traz as três seções numeradas na aba do dia', async () => {
    const wb = await abrirPlanilha()
    const segunda = wb.worksheets[1]!
    const titulos: string[] = []
    segunda.eachRow((row) => {
      const v = row.getCell(1).value
      if (typeof v === 'string' && /^\d\./.test(v)) titulos.push(v)
    })
    expect(titulos).toEqual([
      '1. MÃO DE OBRA — DETALHAMENTO POR FUNCIONÁRIO',
      '2. ALIMENTAÇÃO — QUENTINHAS DO DIA',
      '3. RESUMO DO DIA',
    ])
  })

  it('traz os cinco blocos numerados no resumo da semana', async () => {
    const wb = await abrirPlanilha()
    const resumo = wb.getWorksheet('Resumo Semanal')!
    const titulos: string[] = []
    resumo.eachRow((row) => {
      const v = row.getCell(1).value
      if (typeof v === 'string' && /^\d\./.test(v)) titulos.push(v)
    })
    expect(titulos).toEqual([
      '1. FECHAMENTO POR DIA',
      '2. GASTOS POR FUNCIONÁRIO',
      '3. GASTOS COM QUENTINHAS — SEPARADO POR VALOR UNITÁRIO',
      '4. GASTO GERAL DA SEMANA',
      '5. ACUMULADO DA OBRA',
    ])
  })

  it('escreve os totais como fórmula, nunca como número digitado', async () => {
    const wb = await abrirPlanilha()
    const resumo = wb.getWorksheet('Resumo Semanal')!

    const formulas: string[] = []
    resumo.eachRow((row) =>
      row.eachCell((cell) => {
        if (cell.type === ExcelJS.ValueType.Formula) {
          formulas.push((cell.value as ExcelJS.CellFormulaValue).formula)
        }
      }),
    )

    expect(formulas.some((f) => f.startsWith('SUM('))).toBe(true)
    // custo da quentinha = valor unitario x quantidade
    expect(formulas.some((f) => /^A\d+\*B\d+$/.test(f))).toBe(true)
    // gasto geral = total de mao de obra + total de alimentacao
    expect(formulas.some((f) => /^F\d+\+C\d+$/.test(f))).toBe(true)
  })

  it('separa as faixas de quentinha no resumo', async () => {
    const wb = await abrirPlanilha()
    const resumo = wb.getWorksheet('Resumo Semanal')!

    const valoresUnitarios: number[] = []
    resumo.eachRow((row) => {
      const a = row.getCell(1).value
      const b = row.getCell(2).value
      if (typeof a === 'number' && typeof b === 'number') valoresUnitarios.push(a)
    })
    expect(valoresUnitarios).toEqual([15, 18])
  })

  it('usa o acumulado da obra quando ele é informado', async () => {
    const buffer = await gerarPlanilhaSemanal({
      fechamento,
      empresa: EMPRESA,
      obraNome: 'Reforma Center Paes',
      clienteNome: 'Center Paes',
      acumulado: [
        { numero: 1, data_inicio: '2026-07-20', data_fim: '2026-07-25',
          diarias: 16, mao_obra: 234000, qtd_quentinhas: 12, alimentacao: 26400, total: 260400 },
        { numero: 2, data_inicio: '2026-07-27', data_fim: '2026-07-31',
          diarias: 19, mao_obra: 237000, qtd_quentinhas: 19, alimentacao: 33400, total: 270400 },
      ],
    })
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as unknown as ArrayBuffer)
    const resumo = wb.getWorksheet('Resumo Semanal')!

    const semanas: string[] = []
    resumo.eachRow((row) => {
      const v = row.getCell(1).value
      if (typeof v === 'string' && /^Semana \d+$/.test(v)) semanas.push(v)
    })
    expect(semanas).toEqual(['Semana 1', 'Semana 2'])
  })

  it('registra os dias sem expediente na nota do resumo', async () => {
    const wb = await abrirPlanilha()
    const resumo = wb.getWorksheet('Resumo Semanal')!
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

  it('leva a observação do dia em vermelho', async () => {
    const wb = await abrirPlanilha()
    const segunda = wb.worksheets[1]!
    let obs: ExcelJS.Cell | undefined
    segunda.eachRow((row) => {
      const v = row.getCell(1).value
      if (typeof v === 'string' && v.startsWith('Observação:')) obs = row.getCell(1)
    })
    expect(obs!.value).toContain('entrou depois do almoço')
    expect(obs!.font?.color?.argb).toBe('FFC00000')
    expect(obs!.font?.italic).toBe(true)
  })
})

describe('a logo da empresa no topo da planilha (regra 11.3)', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  const URL_LOGO = 'https://projeto.supabase.co/storage/v1/object/publico/rv.png'

  function servirLogo(bytes: Uint8Array) {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      headers: { get: () => String(bytes.length) },
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    })))
  }

  async function gerar(logo_url: string) {
    const buffer = await gerarPlanilhaSemanal({
      fechamento: calcularFechamentoSemanal({ semana, funcionarios, lancamentos, quentinhas }),
      empresa: { ...EMPRESA, logo_url },
      obraNome: 'Obra do piso',
      clienteNome: 'Cliente',
    })
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as unknown as ArrayBuffer)
    return wb
  }

  it('embute a imagem uma única vez, mesmo com várias abas', async () => {
    servirLogo(pngFalso(240, 80))
    const wb = await gerar(URL_LOGO)

    // uma imagem guardada no arquivo...
    expect(wb.model.media).toHaveLength(1)
    // ...e desenhada em todas as abas, inclusive no resumo
    expect(wb.worksheets.length).toBeGreaterThan(1)
    for (const ws of wb.worksheets) {
      expect(ws.getImages()).toHaveLength(1)
    }
  })

  it('recua o título para ele não ficar por baixo da logo', async () => {
    servirLogo(pngFalso(240, 80))
    const comLogo = await gerar(URL_LOGO)

    const recuo = (wb: ExcelJS.Workbook) =>
      wb.worksheets[0]!.getCell('A1').alignment?.indent ?? 0

    expect(recuo(comLogo)).toBeGreaterThan(0)
    // uma logo mais larga empurra o título mais para a direita
    servirLogo(pngFalso(600, 80))
    expect(recuo(await gerar(URL_LOGO))).toBeGreaterThan(recuo(comLogo))
  })

  it('sem logo configurada, sai a logo que veio com o app', async () => {
    const wb = await gerar('')
    expect(wb.model.media).toHaveLength(1)
    expect(wb.worksheets[0]!.getImages()).toHaveLength(1)
    expect(wb.worksheets[0]!.getCell('A1').value).toContain('RV Engenharia')
  })

  it('se a logo configurada não carregar, cai na do app em vez de sair sem marca', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('bucket fora do ar') }))
    const wb = await gerar(URL_LOGO)
    expect(wb.model.media).toHaveLength(1)
    expect(wb.worksheets[0]!.getCell('A1').value).toContain('RV Engenharia')
  })
})
