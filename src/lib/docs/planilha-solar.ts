import 'server-only'
import ExcelJS from 'exceljs'
import { centavosParaPlanilha, formatarData, hojeISO } from '@/lib/format'
import type { DadosEmpresa } from '@/lib/parametros'
import type { Dimensionamento, Economia, AnoProjetado } from '@/lib/domain/solar'
import type { CotacaoSolar } from '@/lib/domain/proposta-solar'
import { itensParaProposta } from '@/lib/domain/proposta-solar'
import type { ProjetoSolar } from '@/lib/dados/solar'
import {
  MOEDA,
  borda,
  cabecalhoDoc,
  estiloCabecalhoTabela,
  estiloSubtotal,
  estiloTotal,
  faixaSecao,
} from './estilo-planilha'
import { buscarLogo, type LogoPlanilha } from './logo-planilha'

/**
 * Proposta solar em xlsx (spec 5.7).
 *
 * A aba "Proposta" e a que vai ao cliente: equipamentos com quantidade, sem
 * preco item a item, e o investimento como valor global. A aba "Apuracao" tem
 * custo e margem e existe so para uso interno — vem separada de proposito, para
 * ser apagada antes de enviar, se for o caso.
 */
export async function gerarPlanilhaSolar(opcoes: {
  projeto: ProjetoSolar
  dimensionamento: Dimensionamento
  cotacao: CotacaoSolar
  economia: Economia
  projecao: AnoProjetado[]
  investimento: number
  empresa: DadosEmpresa
  incluirApuracao: boolean
}): Promise<Buffer> {
  const logo = await buscarLogo(opcoes.empresa.logo_url)
  const wb = new ExcelJS.Workbook()
  wb.creator = opcoes.empresa.nome
  wb.created = new Date()

  abaProposta(wb, opcoes, logo)
  abaProjecao(wb, opcoes, logo)
  if (opcoes.incluirApuracao) abaApuracao(wb, opcoes, logo)

  return Buffer.from(await wb.xlsx.writeBuffer())
}

type Opcoes = Parameters<typeof gerarPlanilhaSolar>[0]

function contexto(o: Opcoes, logo: LogoPlanilha | null) {
  return {
    logo,
    empresa: o.empresa,
    obraNome: `UC ${o.projeto.uc ?? '—'} · ${o.projeto.concessionaria ?? ''}`,
    clienteNome: o.projeto.cliente_nome,
  }
}

function abaProposta(wb: ExcelJS.Workbook, o: Opcoes, logo: LogoPlanilha | null) {
  const ws = wb.addWorksheet('Proposta', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  })
  ws.columns = [{ width: 48 }, { width: 20 }, { width: 18 }]

  cabecalhoDoc(ws, 'Proposta de energia solar', contexto(o, logo), 3)

  let linha = 4
  faixaSecao(ws, linha, 3, 'Diagnóstico do consumo')
  linha++

  const d = o.dimensionamento
  const dados: [string, string | number][] = [
    ['Consumo médio mensal (kWh)', Math.round(d.consumo_medio_mensal)],
    ['Custo de disponibilidade (kWh)', d.custo_disponibilidade],
    ['Energia a compensar (kWh/mês)', Math.round(d.energia_a_compensar)],
  ]
  for (const [rotulo, valor] of dados) {
    const r = ws.getRow(linha)
    r.getCell(1).value = rotulo
    r.getCell(2).value = valor
    r.getCell(1).border = borda()
    r.getCell(2).border = borda()
    linha++
  }

  linha++
  faixaSecao(ws, linha, 3, 'Sistema proposto')
  linha++
  const sistema: [string, string | number][] = [
    ['Potência instalada (kWp)', Math.round(d.potencia_instalada_kwp * 100) / 100],
    ['Quantidade de módulos', d.qtd_modulos],
    ['Inversor (kW)', Math.round(d.potencia_inversor_kw * 100) / 100],
    ['Área necessária (m²)', Math.round(d.area_necessaria_m2 * 100) / 100],
    ['Geração mensal estimada (kWh)', Math.round(d.geracao_mensal_estimada)],
  ]
  for (const [rotulo, valor] of sistema) {
    const r = ws.getRow(linha)
    r.getCell(1).value = rotulo
    r.getCell(2).value = valor
    r.getCell(1).border = borda()
    r.getCell(2).border = borda()
    linha++
  }

  linha++
  faixaSecao(ws, linha, 3, 'Equipamentos e serviços inclusos')
  linha++
  const cab = ws.getRow(linha)
  cab.values = ['Item', 'Quantidade', '']
  estiloCabecalhoTabela(cab)
  linha++

  // Sem preco item a item: e a regra do item 5.7.
  for (const item of itensParaProposta(o.cotacao)) {
    const r = ws.getRow(linha)
    r.getCell(1).value = item.descricao
    r.getCell(2).value = item.quantidade
    r.getCell(1).border = borda()
    r.getCell(2).border = borda()
    linha++
  }

  linha++
  faixaSecao(ws, linha, 3, 'Economia e investimento')
  linha++

  const economia: [string, number][] = [
    ['Economia líquida por mês', o.economia.economia_liquida_mes],
    ['Economia no primeiro ano', o.economia.economia_ano_1],
    ['Economia acumulada em 25 anos', o.projecao.at(-1)?.acumulado ?? 0],
  ]
  for (const [rotulo, valor] of economia) {
    const r = ws.getRow(linha)
    r.getCell(1).value = rotulo
    r.getCell(2).value = centavosParaPlanilha(valor)
    r.getCell(2).numFmt = MOEDA
    r.getCell(1).border = borda()
    r.getCell(2).border = borda()
    linha++
  }

  const payback = ws.getRow(linha)
  payback.getCell(1).value = 'Retorno do investimento (anos)'
  payback.getCell(2).value =
    o.economia.payback_anos === null ? '—' : Math.round(o.economia.payback_anos * 10) / 10
  estiloSubtotal(payback)
  linha++

  const total = ws.getRow(linha)
  total.getCell(1).value = 'INVESTIMENTO TOTAL'
  total.getCell(2).value = centavosParaPlanilha(o.investimento)
  total.getCell(2).numFmt = MOEDA
  estiloTotal(total)
  linha += 2

  ws.getCell(linha, 1).value = `Proposta emitida em ${formatarData(hojeISO())}. ${o.empresa.responsavel} — ${o.empresa.crea}.`
  ws.getCell(linha, 1).font = { size: 9, italic: true }
}

function abaProjecao(wb: ExcelJS.Workbook, o: Opcoes, logo: LogoPlanilha | null) {
  const ws = wb.addWorksheet('Projeção 25 anos', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  })
  ws.columns = [{ width: 10 }, { width: 18 }, { width: 18 }, { width: 20 }]

  cabecalhoDoc(ws, 'Projeção de economia em 25 anos', contexto(o, logo), 4)

  let linha = 4
  const cab = ws.getRow(linha)
  cab.values = ['Ano', 'Geração (kWh)', 'Economia', 'Acumulado']
  estiloCabecalhoTabela(cab)
  linha++

  const primeira = linha
  for (const ano of o.projecao) {
    const r = ws.getRow(linha)
    r.getCell(1).value = ano.ano
    r.getCell(2).value = Math.round(ano.geracao_kwh)
    r.getCell(3).value = centavosParaPlanilha(ano.economia)
    // acumulado por formula: soma corrente da coluna de economia
    r.getCell(4).value = { formula: `SUM(C${primeira}:C${linha})` }
    r.getCell(3).numFmt = MOEDA
    r.getCell(4).numFmt = MOEDA
    r.eachCell((c) => (c.border = borda()))
    linha++
  }

  const total = ws.getRow(linha)
  total.getCell(1).value = 'Total'
  total.getCell(3).value = { formula: `SUM(C${primeira}:C${linha - 1})` }
  total.getCell(3).numFmt = MOEDA
  estiloTotal(total)
}

function abaApuracao(wb: ExcelJS.Workbook, o: Opcoes, logo: LogoPlanilha | null) {
  const ws = wb.addWorksheet('Apuração (interna)', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  })
  ws.columns = [{ width: 42 }, { width: 8 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 22 }]

  cabecalhoDoc(ws, 'Apuração de custo — uso interno, não enviar ao cliente', contexto(o, logo), 6)

  let linha = 4
  const cab = ws.getRow(linha)
  cab.values = ['Item', 'Un.', 'Qtd.', 'Custo unit.', 'Custo total', 'Fornecedor']
  estiloCabecalhoTabela(cab)
  linha++

  const primeira = linha
  for (const item of o.cotacao.itens) {
    const r = ws.getRow(linha)
    r.getCell(1).value = item.descricao
    r.getCell(2).value = item.unidade
    r.getCell(3).value = item.quantidade
    r.getCell(4).value = centavosParaPlanilha(item.custo_unitario)
    r.getCell(5).value = { formula: `C${linha}*D${linha}` }
    r.getCell(6).value = item.fornecedor ?? ''
    r.getCell(4).numFmt = MOEDA
    r.getCell(5).numFmt = MOEDA
    r.eachCell((c) => (c.border = borda()))
    linha++
  }
  const ultima = linha - 1

  const custo = ws.getRow(linha)
  custo.getCell(1).value = 'Custo total'
  custo.getCell(5).value = { formula: `SUM(E${primeira}:E${ultima})` }
  custo.getCell(5).numFmt = MOEDA
  estiloSubtotal(custo)
  const linhaCusto = linha
  linha++

  const venda = ws.getRow(linha)
  venda.getCell(1).value = 'Preço de venda'
  venda.getCell(5).value = centavosParaPlanilha(o.cotacao.preco_venda)
  venda.getCell(5).numFmt = MOEDA
  estiloSubtotal(venda)
  const linhaVenda = linha
  linha++

  const margem = ws.getRow(linha)
  margem.getCell(1).value = 'Margem'
  margem.getCell(5).value = { formula: `E${linhaVenda}-E${linhaCusto}` }
  margem.getCell(5).numFmt = MOEDA
  estiloTotal(margem)
}
