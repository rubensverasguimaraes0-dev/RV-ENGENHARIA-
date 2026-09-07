import 'server-only'
import ExcelJS from 'exceljs'
import type { AbaDia, FechamentoSemanal } from '@/lib/domain/fechamento-semanal'
import { centavosParaPlanilha, formatarData, nomeDoDia } from '@/lib/format'
import type { DadosEmpresa } from '@/lib/parametros'
import {
  DIARIAS,
  INTEIRO,
  MOEDA,
  borda,
  cabecalhoDoc,
  estiloCabecalhoTabela,
  estiloSubtotal,
  estiloTotalVerde,
  faixaSecao,
  finalizarAba,
  linhaObservacao,
  nomeDeAba,
} from './estilo-planilha'
import { buscarLogo, type LogoPlanilha } from './logo-planilha'

/**
 * Fechamento semanal em xlsx, no formato de
 * documentos/padrao/relatorios-de-diarias.md, secao 3:
 *
 *   Parametros · uma aba por dia · Resumo Semanal
 *
 * Duas regras do padrao mandam na estrutura:
 *  - as abas de dia listam TODA a equipe da semana, com "-" em quem faltou —
 *    e nao so quem apareceu naquele dia;
 *  - todo subtotal e total sai por formula (spec 11.2), para o valor conferir
 *    sozinho quando alguem editar a planilha.
 *
 * O valor do dia de cada funcionario e escrito como numero, e nao como
 * "diaria x presenca": ele vem congelado do lancamento e pode ter sido
 * editado pelo administrador, entao a multiplicacao mentiria.
 */

/** Uma linha por semana da obra, para o bloco 5 do resumo. */
export interface LinhaAcumulada {
  numero: number
  data_inicio: string
  data_fim: string
  diarias: number
  mao_obra: number
  qtd_quentinhas: number
  alimentacao: number
  total: number
}

export async function gerarPlanilhaSemanal(opcoes: {
  fechamento: FechamentoSemanal
  empresa: DadosEmpresa
  obraNome: string
  clienteNome: string
  /** Semanas anteriores da obra. Vazio gera o bloco so com a semana atual. */
  acumulado?: LinhaAcumulada[]
}): Promise<Buffer> {
  const { fechamento: f, empresa, obraNome, clienteNome, acumulado = [] } = opcoes
  const logo = await buscarLogo(empresa.logo_url)
  const ctx: Contexto = { obraNome, clienteNome, empresa, logo, semana: f.semana.numero }

  const wb = new ExcelJS.Workbook()
  wb.creator = empresa.nome
  wb.created = new Date()

  abaParametros(wb, f, ctx)
  for (const dia of f.dias) abaDoDia(wb, dia, f, ctx)
  abaResumo(wb, f, acumulado, ctx)

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

interface Contexto {
  obraNome: string
  clienteNome: string
  empresa: DadosEmpresa
  logo?: LogoPlanilha | null
  semana: number
}

const RETRATO = {
  paperSize: 9,
  orientation: 'portrait' as const,
  fitToPage: true,
  fitToWidth: 1,
  fitToHeight: 0,
}

const PERIODO = (inicio: string, fim: string) => `${formatarData(inicio)} a ${formatarData(fim)}`

// -----------------------------------------------------------------------------
// Aba 1 — Parametros
// -----------------------------------------------------------------------------

function abaParametros(wb: ExcelJS.Workbook, f: FechamentoSemanal, ctx: Contexto) {
  const ws = wb.addWorksheet('Parâmetros', { pageSetup: RETRATO })
  ws.columns = [{ width: 30 }, { width: 20 }, { width: 16 }, { width: 18 }]

  cabecalhoDoc(ws, `Parâmetros — Semana ${f.semana.numero}`, ctx, 4)

  let linha = 4
  faixaSecao(ws, linha, 4, '1. SEMANA DE REFERÊNCIA')
  linha++
  for (const [rotulo, valor] of [
    ['Semana', `Semana ${f.semana.numero}`],
    ['Período', PERIODO(f.semana.data_inicio, f.semana.data_fim)],
    ['Dias com lançamento', String(f.dias.filter((d) => d.qtd_presentes > 0).length)],
  ] as const) {
    const r = ws.getRow(linha)
    r.getCell(1).value = rotulo
    r.getCell(2).value = valor
    r.getCell(1).border = borda()
    r.getCell(2).border = borda()
    linha++
  }
  linha++

  faixaSecao(ws, linha, 4, '2. EQUIPE DA SEMANA')
  linha++
  const cab = ws.getRow(linha)
  cab.values = ['Funcionário', 'Função', 'Diária (R$)', 'Situação']
  estiloCabecalhoTabela(cab)
  linha++
  for (const r of f.funcionarios) {
    const row = ws.getRow(linha)
    row.getCell(1).value = r.nome
    row.getCell(2).value = r.funcao
    row.getCell(3).value = centavosParaPlanilha(r.valor_diaria_padrao)
    row.getCell(3).numFmt = MOEDA
    row.getCell(4).value = r.tipo === 'parceiro' ? 'Parceiro' : 'Ativo na semana'
    row.eachCell((c) => (c.border = borda()))
    linha++
  }
  linha++

  faixaSecao(ws, linha, 4, '3. PREÇO DA QUENTINHA PRATICADO NA SEMANA')
  linha++
  const cabQ = ws.getRow(linha)
  cabQ.values = ['Valor unitário', 'Quantidade', 'Custo', '']
  estiloCabecalhoTabela(cabQ)
  linha++
  for (const faixa of f.faixas_quentinha) {
    const row = ws.getRow(linha)
    row.getCell(1).value = centavosParaPlanilha(faixa.valor_unitario)
    row.getCell(1).numFmt = MOEDA
    row.getCell(2).value = faixa.quantidade
    row.getCell(2).numFmt = INTEIRO
    row.getCell(3).value = { formula: `A${linha}*B${linha}` }
    row.getCell(3).numFmt = MOEDA
    for (let c = 1; c <= 3; c++) row.getCell(c).border = borda()
    linha++
  }
  linha++

  faixaSecao(ws, linha, 4, '4. COMO USAR')
  linha++
  for (const texto of [
    'Uma aba por dia lançado, mais o Resumo Semanal ao final.',
    'Os valores em preto são fórmulas: mudando um dia, os totais se refazem sozinhos.',
    'O total do bloco 1 (por dia) e o do bloco 2 (por funcionário) têm de bater — é a conferência.',
    'Só entra na planilha quem teve presença nesta semana.',
  ]) {
    ws.mergeCells(linha, 1, linha, 4)
    const c = ws.getCell(linha, 1)
    c.value = texto
    c.font = { size: 9, italic: true }
    linha++
  }

  finalizarAba(ws, 4)
}

// -----------------------------------------------------------------------------
// Abas de dia
// -----------------------------------------------------------------------------

function abaDoDia(
  wb: ExcelJS.Workbook,
  dia: AbaDia,
  f: FechamentoSemanal,
  ctx: Contexto,
) {
  const nome = `${nomeDoDia(dia.data)} ${formatarData(dia.data).slice(0, 5).replace('/', '-')}`
  const ws = wb.addWorksheet(nomeDeAba(nome), { pageSetup: RETRATO })
  ws.columns = [
    { width: 28 },
    { width: 18 },
    { width: 14 },
    { width: 11 },
    { width: 16 },
    { width: 13 },
  ]

  cabecalhoDoc(ws, `Semana ${ctx.semana} — ${nomeDoDia(dia.data)}, ${formatarData(dia.data)}`, ctx, 6)

  let linha = 4
  faixaSecao(ws, linha, 6, '1. MÃO DE OBRA — DETALHAMENTO POR FUNCIONÁRIO')
  linha++

  const cab = ws.getRow(linha)
  cab.values = ['Funcionário', 'Função', 'Diária (R$)', 'Presença', 'Valor do Dia (R$)', 'Vale (R$)']
  estiloCabecalhoTabela(cab)
  linha++

  // Toda a equipe da semana entra; quem faltou fica com traco nas colunas de
  // presenca e valor, e nao com a linha ausente (padrao, secao 3).
  const presentes = new Map(dia.linhas.map((l) => [l.funcionario_id, l]))
  const primeira = linha
  for (const pessoa of f.funcionarios) {
    const presente = presentes.get(pessoa.funcionario_id)
    const row = ws.getRow(linha)
    row.getCell(1).value = pessoa.nome
    row.getCell(2).value = pessoa.funcao
    row.getCell(3).value = centavosParaPlanilha(pessoa.valor_diaria_padrao)
    row.getCell(4).value = presente ? presente.fator_presenca : null
    row.getCell(5).value = presente ? centavosParaPlanilha(presente.valor_diaria) : null
    row.getCell(6).value = presente && presente.valor_vale > 0 ? centavosParaPlanilha(presente.valor_vale) : null
    row.getCell(3).numFmt = MOEDA
    row.getCell(4).numFmt = DIARIAS
    row.getCell(5).numFmt = MOEDA
    row.getCell(6).numFmt = MOEDA
    row.getCell(4).alignment = { horizontal: 'center' }
    row.eachCell({ includeEmpty: true }, (c) => (c.border = borda()))
    linha++
  }
  const ultima = linha - 1
  const houve = f.funcionarios.length > 0

  const subtotal = ws.getRow(linha)
  subtotal.getCell(1).value = `Subtotal mão de obra (${formatarDiarias(dia.diarias)} diárias)`
  subtotal.getCell(4).value = houve ? { formula: `SUM(D${primeira}:D${ultima})` } : 0
  subtotal.getCell(5).value = houve ? { formula: `SUM(E${primeira}:E${ultima})` } : 0
  subtotal.getCell(6).value = houve ? { formula: `SUM(F${primeira}:F${ultima})` } : 0
  subtotal.getCell(4).numFmt = DIARIAS
  subtotal.getCell(5).numFmt = MOEDA
  subtotal.getCell(6).numFmt = MOEDA
  subtotal.getCell(4).alignment = { horizontal: 'center' }
  estiloSubtotal(subtotal)
  const linhaMaoObra = linha
  linha += 2

  faixaSecao(ws, linha, 6, '2. ALIMENTAÇÃO — QUENTINHAS DO DIA')
  linha++
  const cabQ = ws.getRow(linha)
  cabQ.values = ['Valor unitário', 'Quantidade', 'Custo', '', '', '']
  estiloCabecalhoTabela(cabQ)
  linha++

  const primeiraQ = linha
  for (const q of dia.quentinhas) {
    const row = ws.getRow(linha)
    row.getCell(1).value = centavosParaPlanilha(q.valor_unitario)
    row.getCell(1).numFmt = MOEDA
    row.getCell(2).value = q.quantidade
    row.getCell(2).numFmt = INTEIRO
    row.getCell(3).value = { formula: `A${linha}*B${linha}` }
    row.getCell(3).numFmt = MOEDA
    for (let c = 1; c <= 3; c++) row.getCell(c).border = borda()
    linha++
  }
  const ultimaQ = linha - 1
  const houveQ = dia.quentinhas.length > 0

  const totalQ = ws.getRow(linha)
  totalQ.getCell(1).value = dia.sabado && !houveQ ? 'Sábado até meio-dia — sem quentinha' : 'Total de quentinhas'
  totalQ.getCell(2).value = houveQ ? { formula: `SUM(B${primeiraQ}:B${ultimaQ})` } : 0
  totalQ.getCell(3).value = houveQ ? { formula: `SUM(C${primeiraQ}:C${ultimaQ})` } : 0
  totalQ.getCell(2).numFmt = INTEIRO
  totalQ.getCell(3).numFmt = MOEDA
  estiloSubtotal(totalQ)
  const linhaQuentinhas = linha
  linha += 2

  faixaSecao(ws, linha, 6, '3. RESUMO DO DIA')
  linha++
  for (const [rotulo, valor, formato] of [
    ['Diárias', { formula: `D${linhaMaoObra}` }, DIARIAS],
    ['Quentinhas (un.)', { formula: `B${linhaQuentinhas}` }, INTEIRO],
    ['Custo de mão de obra', { formula: `E${linhaMaoObra}` }, MOEDA],
    ['Custo de alimentação', { formula: `C${linhaQuentinhas}` }, MOEDA],
  ] as [string, ExcelJS.CellValue, string][]) {
    const row = ws.getRow(linha)
    row.getCell(1).value = rotulo
    row.getCell(2).value = valor
    row.getCell(2).numFmt = formato
    row.getCell(1).border = borda()
    row.getCell(2).border = borda()
    linha++
  }

  const total = ws.getRow(linha)
  total.getCell(1).value = 'TOTAL DO DIA'
  total.getCell(2).value = { formula: `E${linhaMaoObra}+C${linhaQuentinhas}` }
  total.getCell(2).numFmt = MOEDA
  estiloTotalVerde(total)
  linha++

  const observacoes = [...new Set(dia.linhas.map((l) => l.observacao).filter(Boolean))] as string[]
  if (observacoes.length > 0) {
    linha++
    linhaObservacao(ws, linha, 6, `Observação: ${observacoes.join(' · ')}`)
  }

  finalizarAba(ws, 6)
}

// -----------------------------------------------------------------------------
// Aba final — Resumo Semanal
// -----------------------------------------------------------------------------

function abaResumo(
  wb: ExcelJS.Workbook,
  f: FechamentoSemanal,
  acumulado: LinhaAcumulada[],
  ctx: Contexto,
) {
  const ws = wb.addWorksheet('Resumo Semanal', { pageSetup: RETRATO })
  ws.columns = [
    { width: 28 },
    { width: 20 },
    { width: 13 },
    { width: 16 },
    { width: 14 },
    { width: 16 },
  ]

  cabecalhoDoc(
    ws,
    `Semana ${f.semana.numero} — ${PERIODO(f.semana.data_inicio, f.semana.data_fim)}`,
    ctx,
    6,
  )

  let linha = 4

  // 1. FECHAMENTO POR DIA
  faixaSecao(ws, linha, 6, '1. FECHAMENTO POR DIA')
  linha++
  const cab1 = ws.getRow(linha)
  cab1.values = ['Dia', 'Data', 'Diárias', 'Mão de obra', 'Quentinhas (un.)', 'Total do dia']
  estiloCabecalhoTabela(cab1)
  linha++
  const primeiroDia = linha
  for (const dia of f.dias) {
    const row = ws.getRow(linha)
    row.getCell(1).value = nomeDoDia(dia.data)
    row.getCell(2).value = formatarData(dia.data)
    row.getCell(3).value = dia.diarias
    row.getCell(4).value = centavosParaPlanilha(dia.total_mao_obra)
    row.getCell(5).value = dia.qtd_quentinhas
    row.getCell(6).value = { formula: `D${linha}+${centavosParaPlanilha(dia.total_quentinhas)}` }
    row.getCell(3).numFmt = DIARIAS
    row.getCell(4).numFmt = MOEDA
    row.getCell(5).numFmt = INTEIRO
    row.getCell(6).numFmt = MOEDA
    row.eachCell({ includeEmpty: true }, (c) => (c.border = borda()))
    linha++
  }
  const ultimoDia = linha - 1
  const houveDias = f.dias.length > 0
  const total1 = ws.getRow(linha)
  total1.getCell(1).value = 'TOTAL — FECHAMENTO POR DIA'
  for (const col of [3, 4, 5, 6]) {
    const letra = String.fromCharCode(64 + col)
    total1.getCell(col).value = houveDias ? { formula: `SUM(${letra}${primeiroDia}:${letra}${ultimoDia})` } : 0
  }
  total1.getCell(3).numFmt = DIARIAS
  total1.getCell(4).numFmt = MOEDA
  total1.getCell(5).numFmt = INTEIRO
  total1.getCell(6).numFmt = MOEDA
  estiloSubtotal(total1)
  linha += 2

  // 2. GASTOS POR FUNCIONÁRIO
  faixaSecao(ws, linha, 6, '2. GASTOS POR FUNCIONÁRIO')
  linha++
  const cab2 = ws.getRow(linha)
  cab2.values = [
    'Funcionário',
    'Função',
    'Valor da diária',
    'Diárias na semana',
    'Vales',
    'Total a pagar',
  ]
  estiloCabecalhoTabela(cab2)
  linha++
  const primeiroF = linha
  for (const r of f.funcionarios) {
    const row = ws.getRow(linha)
    row.getCell(1).value = r.nome
    row.getCell(2).value = r.funcao
    row.getCell(3).value = centavosParaPlanilha(r.valor_diaria_padrao)
    row.getCell(4).value = r.diarias
    row.getCell(5).value = r.total_vales > 0 ? centavosParaPlanilha(r.total_vales) : null
    row.getCell(6).value = centavosParaPlanilha(r.total_diarias)
    row.getCell(3).numFmt = MOEDA
    row.getCell(4).numFmt = DIARIAS
    row.getCell(5).numFmt = MOEDA
    row.getCell(6).numFmt = MOEDA
    row.eachCell({ includeEmpty: true }, (c) => (c.border = borda()))
    linha++
  }
  const ultimoF = linha - 1
  const houveF = f.funcionarios.length > 0
  const total2 = ws.getRow(linha)
  total2.getCell(1).value = 'TOTAL — MÃO DE OBRA DA SEMANA'
  for (const col of [4, 5, 6]) {
    const letra = String.fromCharCode(64 + col)
    total2.getCell(col).value = houveF ? { formula: `SUM(${letra}${primeiroF}:${letra}${ultimoF})` } : 0
  }
  total2.getCell(4).numFmt = DIARIAS
  total2.getCell(5).numFmt = MOEDA
  total2.getCell(6).numFmt = MOEDA
  estiloSubtotal(total2)
  const linhaMaoObra = linha
  linha += 2

  // 3. QUENTINHAS POR VALOR UNITÁRIO
  faixaSecao(ws, linha, 6, '3. GASTOS COM QUENTINHAS — SEPARADO POR VALOR UNITÁRIO')
  linha++
  const cab3 = ws.getRow(linha)
  cab3.values = ['Valor unitário', 'Quantidade', 'Custo', '', '', '']
  estiloCabecalhoTabela(cab3)
  linha++
  const primeiraQ = linha
  for (const faixa of f.faixas_quentinha) {
    const row = ws.getRow(linha)
    row.getCell(1).value = centavosParaPlanilha(faixa.valor_unitario)
    row.getCell(1).numFmt = MOEDA
    row.getCell(2).value = faixa.quantidade
    row.getCell(2).numFmt = INTEIRO
    row.getCell(3).value = { formula: `A${linha}*B${linha}` }
    row.getCell(3).numFmt = MOEDA
    for (let c = 1; c <= 3; c++) row.getCell(c).border = borda()
    linha++
  }
  const ultimaQ = linha - 1
  const houveQ = f.faixas_quentinha.length > 0
  const total3 = ws.getRow(linha)
  total3.getCell(1).value = 'TOTAL DE QUENTINHAS DA SEMANA'
  total3.getCell(2).value = houveQ ? { formula: `SUM(B${primeiraQ}:B${ultimaQ})` } : 0
  total3.getCell(3).value = houveQ ? { formula: `SUM(C${primeiraQ}:C${ultimaQ})` } : 0
  total3.getCell(2).numFmt = INTEIRO
  total3.getCell(3).numFmt = MOEDA
  estiloSubtotal(total3)
  const linhaQuentinhas = linha
  linha += 2

  // 4. GASTO GERAL DA SEMANA
  faixaSecao(ws, linha, 6, '4. GASTO GERAL DA SEMANA')
  linha++
  for (const [rotulo, formula] of [
    ['Total de mão de obra', `F${linhaMaoObra}`],
    ['Total de alimentação', `C${linhaQuentinhas}`],
    ['Vales descontados', `E${linhaMaoObra}`],
  ] as const) {
    const row = ws.getRow(linha)
    row.getCell(1).value = rotulo
    row.getCell(2).value = { formula }
    row.getCell(2).numFmt = MOEDA
    row.getCell(1).border = borda()
    row.getCell(2).border = borda()
    linha++
  }
  const geral = ws.getRow(linha)
  geral.getCell(1).value = 'GASTO GERAL DA SEMANA'
  geral.getCell(2).value = { formula: `F${linhaMaoObra}+C${linhaQuentinhas}` }
  geral.getCell(2).numFmt = MOEDA
  estiloTotalVerde(geral)
  linha += 2

  // 5. ACUMULADO DA OBRA
  faixaSecao(ws, linha, 6, '5. ACUMULADO DA OBRA')
  linha++
  const cab5 = ws.getRow(linha)
  cab5.values = ['Semana', 'Período', 'Diárias', 'Mão de obra', 'Alimentação', 'Total']
  estiloCabecalhoTabela(cab5)
  linha++

  const linhas =
    acumulado.length > 0
      ? acumulado
      : [
          {
            numero: f.semana.numero,
            data_inicio: f.semana.data_inicio,
            data_fim: f.semana.data_fim,
            diarias: f.diarias,
            mao_obra: f.total_mao_obra,
            qtd_quentinhas: f.qtd_quentinhas,
            alimentacao: f.total_quentinhas,
            total: f.custo_semana,
          },
        ]

  const primeiraA = linha
  for (const s of linhas) {
    const row = ws.getRow(linha)
    row.getCell(1).value = `Semana ${s.numero}`
    row.getCell(2).value = PERIODO(s.data_inicio, s.data_fim)
    row.getCell(3).value = s.diarias
    row.getCell(4).value = centavosParaPlanilha(s.mao_obra)
    row.getCell(5).value = centavosParaPlanilha(s.alimentacao)
    row.getCell(6).value = { formula: `D${linha}+E${linha}` }
    row.getCell(3).numFmt = DIARIAS
    for (const c of [4, 5, 6]) row.getCell(c).numFmt = MOEDA
    row.eachCell({ includeEmpty: true }, (c) => (c.border = borda()))
    linha++
  }
  const ultimaA = linha - 1
  const totalA = ws.getRow(linha)
  totalA.getCell(1).value = 'TOTAL ACUMULADO DA OBRA'
  for (const col of [3, 4, 5, 6]) {
    const letra = String.fromCharCode(64 + col)
    totalA.getCell(col).value = { formula: `SUM(${letra}${primeiraA}:${letra}${ultimaA})` }
  }
  totalA.getCell(3).numFmt = DIARIAS
  for (const c of [4, 5, 6]) totalA.getCell(c).numFmt = MOEDA
  estiloTotalVerde(totalA)
  linha += 2

  const notas = [
    'Os totais dos blocos 1 e 2 têm de bater: é a conferência interna da semana.',
    'Só aparece quem teve presença nesta semana; ausência não é desligamento.',
  ]
  if (f.semana.dias_sem_expediente.length > 0) {
    notas.push(`Sem expediente: ${f.semana.dias_sem_expediente.map(formatarData).join(', ')}.`)
  }
  for (const texto of notas) {
    ws.mergeCells(linha, 1, linha, 6)
    const c = ws.getCell(linha, 1)
    c.value = texto
    c.font = { size: 9, italic: true }
    linha++
  }

  finalizarAba(ws, 6)
}

/** 11.5 vira "11,5"; 9 vira "9". */
function formatarDiarias(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}
