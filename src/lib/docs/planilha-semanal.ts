import 'server-only'
import ExcelJS from 'exceljs'
import type { FechamentoSemanal } from '@/lib/domain/fechamento-semanal'
import { centavosParaPlanilha, formatarData, nomeDoDia } from '@/lib/format'
import { ROTULO_TIPO_DIARIA } from '@/lib/domain/lancamento'
import type { DadosEmpresa } from '@/lib/parametros'

/**
 * Fechamento semanal em xlsx: uma aba por dia da semana + aba de resumo
 * (spec 4.5). Regra 11.2: todo total sai por formula, nunca digitado — por isso
 * as celulas de soma recebem { formula }, e nao o numero ja calculado.
 */

const AZUL = 'FF0B4F8A'
const AZUL_CLARO = 'FFE3EEFB'
const AZUL_ESCURO = 'FF073457'
const MOEDA = 'R$ #,##0.00'

export async function gerarPlanilhaSemanal(opcoes: {
  fechamento: FechamentoSemanal
  empresa: DadosEmpresa
  obraNome: string
  clienteNome: string
}): Promise<Buffer> {
  const { fechamento: f, empresa, obraNome, clienteNome } = opcoes

  const wb = new ExcelJS.Workbook()
  wb.creator = empresa.nome
  wb.created = new Date()

  for (const dia of f.dias) abaDoDia(wb, dia, { obraNome, clienteNome, empresa, semana: f.semana.numero })
  abaResumo(wb, f, { obraNome, clienteNome, empresa })

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

interface Contexto {
  obraNome: string
  clienteNome: string
  empresa: DadosEmpresa
  semana?: number
}

function cabecalho(ws: ExcelJS.Worksheet, titulo: string, ctx: Contexto, colunas: number) {
  const ultima = String.fromCharCode(64 + colunas)

  ws.mergeCells(`A1:${ultima}1`)
  const t = ws.getCell('A1')
  t.value = `${ctx.empresa.nome} — ${titulo}`
  t.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
  t.alignment = { vertical: 'middle' }
  ws.getRow(1).height = 22

  ws.mergeCells(`A2:${ultima}2`)
  const s = ws.getCell('A2')
  s.value = `${ctx.clienteNome} — ${ctx.obraNome}`
  s.font = { size: 10, color: { argb: AZUL_ESCURO } }
  s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } }
}

function estiloCabecalhoTabela(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
    cell.border = borda()
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
}

function borda(): Partial<ExcelJS.Borders> {
  const l = { style: 'thin' as const, color: { argb: 'FFB9CADB' } }
  return { top: l, left: l, bottom: l, right: l }
}

function faixaSecao(ws: ExcelJS.Worksheet, linha: number, colunas: number, texto: string) {
  ws.mergeCells(linha, 1, linha, colunas)
  const c = ws.getCell(linha, 1)
  c.value = texto
  c.font = { bold: true, size: 10, color: { argb: AZUL_ESCURO } }
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } }
  c.border = borda()
}

function abaDoDia(
  wb: ExcelJS.Workbook,
  dia: FechamentoSemanal['dias'][number],
  ctx: Contexto,
) {
  const nome = `${nomeDoDia(dia.data)} ${formatarData(dia.data).slice(0, 5).replace('/', '-')}`
  const ws = wb.addWorksheet(nome.slice(0, 31), {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  })
  ws.columns = [
    { width: 28 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
  ]

  cabecalho(ws, `Semana ${ctx.semana} — ${nomeDoDia(dia.data)}, ${formatarData(dia.data)}`, ctx, 5)

  let linha = 4
  faixaSecao(ws, linha, 5, 'Presença do dia')
  linha++

  const cabTabela = ws.getRow(linha)
  cabTabela.values = ['Funcionário', 'Função', 'Tipo', 'Diária', 'Vale']
  estiloCabecalhoTabela(cabTabela)
  linha++

  const primeiraLinha = linha
  for (const l of dia.linhas) {
    const r = ws.getRow(linha)
    r.values = [
      l.nome,
      l.funcao,
      ROTULO_TIPO_DIARIA[l.tipo_diaria],
      centavosParaPlanilha(l.valor_diaria),
      centavosParaPlanilha(l.valor_vale),
    ]
    r.getCell(4).numFmt = MOEDA
    r.getCell(5).numFmt = MOEDA
    r.eachCell((c) => (c.border = borda()))
    linha++
  }
  const ultimaLinha = linha - 1

  // Totais por formula (spec 11.2)
  const totalPresenca = ws.getRow(linha)
  totalPresenca.getCell(1).value = `Total — ${dia.qtd_presentes} presente(s)`
  if (dia.linhas.length > 0) {
    totalPresenca.getCell(4).value = { formula: `SUM(D${primeiraLinha}:D${ultimaLinha})` }
    totalPresenca.getCell(5).value = { formula: `SUM(E${primeiraLinha}:E${ultimaLinha})` }
  } else {
    totalPresenca.getCell(4).value = 0
    totalPresenca.getCell(5).value = 0
  }
  totalPresenca.getCell(4).numFmt = MOEDA
  totalPresenca.getCell(5).numFmt = MOEDA
  totalPresenca.eachCell((c) => {
    c.font = { bold: true }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F7FB' } }
    c.border = borda()
  })
  const linhaTotalMaoObra = linha
  linha += 2

  faixaSecao(ws, linha, 5, 'Quentinhas do dia')
  linha++
  const cabQ = ws.getRow(linha)
  cabQ.values = ['Valor unitário', 'Quantidade', 'Custo', '', '']
  estiloCabecalhoTabela(cabQ)
  linha++

  const primeiraQ = linha
  for (const q of dia.quentinhas) {
    const r = ws.getRow(linha)
    r.getCell(1).value = centavosParaPlanilha(q.valor_unitario)
    r.getCell(1).numFmt = MOEDA
    r.getCell(2).value = q.quantidade
    r.getCell(3).value = { formula: `A${linha}*B${linha}` }
    r.getCell(3).numFmt = MOEDA
    for (let c = 1; c <= 3; c++) r.getCell(c).border = borda()
    linha++
  }
  const ultimaQ = linha - 1

  const totalQ = ws.getRow(linha)
  totalQ.getCell(1).value = 'Total de quentinhas'
  if (dia.quentinhas.length > 0) {
    totalQ.getCell(2).value = { formula: `SUM(B${primeiraQ}:B${ultimaQ})` }
    totalQ.getCell(3).value = { formula: `SUM(C${primeiraQ}:C${ultimaQ})` }
  } else {
    totalQ.getCell(2).value = 0
    totalQ.getCell(3).value = 0
  }
  totalQ.getCell(3).numFmt = MOEDA
  totalQ.eachCell((c) => {
    c.font = { bold: true }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F7FB' } }
    c.border = borda()
  })
  const linhaTotalQuentinhas = linha
  linha += 2

  // Resumo do dia: soma das duas formulas acima
  const resumo = ws.getRow(linha)
  resumo.getCell(1).value = 'TOTAL DO DIA'
  resumo.getCell(4).value = {
    formula: `D${linhaTotalMaoObra}+C${linhaTotalQuentinhas}`,
  }
  resumo.getCell(4).numFmt = MOEDA
  resumo.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ESCURO } }
    c.border = borda()
  })
}

function abaResumo(wb: ExcelJS.Workbook, f: FechamentoSemanal, ctx: Contexto) {
  const ws = wb.addWorksheet('Resumo da semana', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  })
  ws.columns = [{ width: 28 }, { width: 16 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 14 }]

  cabecalho(
    ws,
    `Semana ${f.semana.numero} — ${formatarData(f.semana.data_inicio)} a ${formatarData(f.semana.data_fim)}`,
    ctx,
    6,
  )

  let linha = 4
  faixaSecao(ws, linha, 6, 'Mão de obra por funcionário')
  linha++

  const cab = ws.getRow(linha)
  cab.values = ['Funcionário', 'Função', 'Dias', 'Diárias', 'Vales', 'Líquido']
  estiloCabecalhoTabela(cab)
  linha++

  const primeira = linha
  for (const r of f.funcionarios) {
    const row = ws.getRow(linha)
    row.values = [
      r.nome,
      r.funcao,
      r.dias_trabalhados,
      centavosParaPlanilha(r.total_diarias),
      centavosParaPlanilha(r.total_vales),
    ]
    row.getCell(6).value = { formula: `D${linha}-E${linha}` }
    for (const c of [4, 5, 6]) row.getCell(c).numFmt = MOEDA
    row.eachCell((c) => (c.border = borda()))
    linha++
  }
  const ultima = linha - 1
  const houve = f.funcionarios.length > 0

  const totalMo = ws.getRow(linha)
  totalMo.getCell(1).value = 'Total de mão de obra'
  totalMo.getCell(3).value = houve ? { formula: `SUM(C${primeira}:C${ultima})` } : 0
  totalMo.getCell(4).value = houve ? { formula: `SUM(D${primeira}:D${ultima})` } : 0
  totalMo.getCell(5).value = houve ? { formula: `SUM(E${primeira}:E${ultima})` } : 0
  totalMo.getCell(6).value = houve ? { formula: `SUM(F${primeira}:F${ultima})` } : 0
  for (const c of [4, 5, 6]) totalMo.getCell(c).numFmt = MOEDA
  totalMo.eachCell((c) => {
    c.font = { bold: true }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F7FB' } }
    c.border = borda()
  })
  const linhaTotalMo = linha
  linha += 2

  faixaSecao(ws, linha, 6, 'Quentinhas por faixa de valor unitário')
  linha++
  const cabQ = ws.getRow(linha)
  cabQ.values = ['Valor unitário', 'Quantidade', 'Custo', '', '', '']
  estiloCabecalhoTabela(cabQ)
  linha++

  const primeiraQ = linha
  for (const faixa of f.faixas_quentinha) {
    const row = ws.getRow(linha)
    row.getCell(1).value = centavosParaPlanilha(faixa.valor_unitario)
    row.getCell(1).numFmt = MOEDA
    row.getCell(2).value = faixa.quantidade
    row.getCell(3).value = { formula: `A${linha}*B${linha}` }
    row.getCell(3).numFmt = MOEDA
    for (let c = 1; c <= 3; c++) row.getCell(c).border = borda()
    linha++
  }
  const ultimaQ = linha - 1
  const houveQ = f.faixas_quentinha.length > 0

  const totalQ = ws.getRow(linha)
  totalQ.getCell(1).value = 'Total de quentinhas'
  totalQ.getCell(2).value = houveQ ? { formula: `SUM(B${primeiraQ}:B${ultimaQ})` } : 0
  totalQ.getCell(3).value = houveQ ? { formula: `SUM(C${primeiraQ}:C${ultimaQ})` } : 0
  totalQ.getCell(3).numFmt = MOEDA
  totalQ.eachCell((c) => {
    c.font = { bold: true }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F7FB' } }
    c.border = borda()
  })
  const linhaTotalQ = linha
  linha += 2

  faixaSecao(ws, linha, 6, 'Fechamento da semana')
  linha++

  const linhas: [string, ExcelJS.CellValue][] = [
    ['Mão de obra', { formula: `D${linhaTotalMo}` }],
    ['Quentinhas', { formula: `C${linhaTotalQ}` }],
    ['Vales descontados', { formula: `E${linhaTotalMo}` }],
    ['Líquido a pagar à equipe', { formula: `F${linhaTotalMo}` }],
  ]
  const inicioFechamento = linha
  for (const [rotulo, valor] of linhas) {
    const row = ws.getRow(linha)
    row.getCell(1).value = rotulo
    row.getCell(2).value = valor
    row.getCell(2).numFmt = MOEDA
    row.getCell(1).border = borda()
    row.getCell(2).border = borda()
    linha++
  }

  const custo = ws.getRow(linha)
  custo.getCell(1).value = 'CUSTO DA SEMANA (mão de obra + quentinhas)'
  custo.getCell(2).value = { formula: `B${inicioFechamento}+B${inicioFechamento + 1}` }
  custo.getCell(2).numFmt = MOEDA
  for (let c = 1; c <= 2; c++) {
    custo.getCell(c).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    custo.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ESCURO } }
    custo.getCell(c).border = borda()
  }

  if (f.semana.dias_sem_expediente.length > 0) {
    linha += 2
    ws.getCell(linha, 1).value = `Sem expediente: ${f.semana.dias_sem_expediente
      .map(formatarData)
      .join(', ')}`
    ws.getCell(linha, 1).font = { size: 9, italic: true }
  }
}
