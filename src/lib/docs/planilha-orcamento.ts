import 'server-only'
import ExcelJS from 'exceljs'
import { centavosParaPlanilha, formatarData } from '@/lib/format'
import type { DadosEmpresa } from '@/lib/parametros'
import type { OrcamentoCalculado } from '@/lib/domain/orcamento'
import type { OrcamentoRow, ItemComPendencia } from '@/lib/dados/orcamento'
import {
  AZUL_CLARO,
  MOEDA,
  borda,
  cabecalhoDoc,
  estiloCabecalhoTabela,
  estiloSubtotal,
  estiloTotal,
  faixaSecao,
} from './estilo-planilha'

/**
 * Orcamento em xlsx (spec 4.13): planilha, aba de pendencias e memorial.
 *
 * Duas regras mandam no formato:
 *  - todo total sai por formula (regra 11.2);
 *  - itens proprios e itens de base referencial ficam visualmente distintos —
 *    aqui, pela coluna de base e pelo fundo azul-claro do item referencial.
 *
 * A planilha e a versao interna: mostra custo e margem. A versao do cliente e o
 * PDF gerado pela tela de documento.
 */
export async function gerarPlanilhaOrcamento(opcoes: {
  orcamento: OrcamentoRow
  calculo: OrcamentoCalculado
  pendencias: ItemComPendencia[]
  empresa: DadosEmpresa
  obraNome: string
  clienteNome: string
}): Promise<Buffer> {
  const { orcamento, calculo, pendencias, empresa, obraNome, clienteNome } = opcoes

  const wb = new ExcelJS.Workbook()
  wb.creator = empresa.nome
  wb.created = new Date()

  abaOrcamento(wb, opcoes)
  if (pendencias.length > 0) abaPendencias(wb, pendencias, { empresa, obraNome, clienteNome })
  if (orcamento.memorial) abaMemorial(wb, orcamento, { empresa, obraNome, clienteNome })
  abaPesquisaPrecos(wb, calculo, { empresa, obraNome, clienteNome })

  return Buffer.from(await wb.xlsx.writeBuffer())
}

interface Ctx {
  empresa: DadosEmpresa
  obraNome: string
  clienteNome: string
}

function abaOrcamento(
  wb: ExcelJS.Workbook,
  {
    orcamento,
    calculo,
    empresa,
    obraNome,
    clienteNome,
  }: {
    orcamento: OrcamentoRow
    calculo: OrcamentoCalculado
    empresa: DadosEmpresa
    obraNome: string
    clienteNome: string
  },
) {
  const ws = wb.addWorksheet('Orçamento', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  })
  ws.columns = [
    { width: 9 },  // fase
    { width: 10 }, // base
    { width: 12 }, // codigo
    { width: 42 }, // descricao
    { width: 8 },  // unidade
    { width: 10 }, // quantidade
    { width: 13 }, // custo unitario
    { width: 13 }, // preco unitario
    { width: 14 }, // total
  ]

  cabecalhoDoc(ws, `Orçamento — ${orcamento.titulo ?? ''}`, { empresa, obraNome, clienteNome }, 9)

  let linha = 4
  faixaSecao(ws, linha, 9, 'Planilha orçamentária')
  linha++

  const cab = ws.getRow(linha)
  cab.values = [
    'Fase',
    'Base',
    'Código',
    'Descrição',
    'Un.',
    'Quantidade',
    'Custo unit.',
    'Preço unit.',
    'Total',
  ]
  estiloCabecalhoTabela(cab)
  linha++

  const primeira = linha
  for (const item of calculo.itens) {
    const r = ws.getRow(linha)
    r.getCell(1).value = item.fase ?? ''
    r.getCell(2).value = item.base_referencia
    r.getCell(3).value = item.codigo_referencia ?? ''
    r.getCell(4).value = item.descricao
    r.getCell(5).value = item.unidade ?? ''
    r.getCell(6).value = item.quantidade ?? ''
    r.getCell(7).value = centavosParaPlanilha(item.custo_unitario)
    r.getCell(8).value = centavosParaPlanilha(item.preco_exibido_unitario)
    // total por formula: quantidade x preco unitario
    r.getCell(9).value = item.terceirizado_sem_valor
      ? 'a cotar'
      : { formula: `IF(ISNUMBER(F${linha}),F${linha}*H${linha},0)` }

    for (const c of [7, 8, 9]) r.getCell(c).numFmt = MOEDA
    r.eachCell((c) => (c.border = borda()))

    // item de base referencial ganha fundo proprio, para nao se confundir com
    // o item de composicao da RV
    if (item.base_referencia !== 'proprio') {
      r.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } }
      })
    }
    if (item.terceirizado_sem_valor) {
      r.getCell(9).font = { italic: true, size: 10 }
    }
    linha++
  }
  const ultima = linha - 1
  const houve = calculo.itens.length > 0

  const subtotal = ws.getRow(linha)
  subtotal.getCell(4).value = 'Subtotal'
  subtotal.getCell(9).value = houve ? { formula: `SUM(I${primeira}:I${ultima})` } : 0
  subtotal.getCell(9).numFmt = MOEDA
  estiloSubtotal(subtotal)
  const linhaSubtotal = linha
  linha++

  let linhaTotal = linhaSubtotal
  if (orcamento.modo_bdi === 'visivel' && orcamento.bdi > 0) {
    const bdi = ws.getRow(linha)
    bdi.getCell(4).value = `BDI (${(orcamento.bdi * 100).toFixed(2).replace('.', ',')}%)`
    bdi.getCell(9).value = { formula: `ROUND(I${linhaSubtotal}*${orcamento.bdi},2)` }
    bdi.getCell(9).numFmt = MOEDA
    estiloSubtotal(bdi)
    linha++

    const total = ws.getRow(linha)
    total.getCell(4).value = 'TOTAL GERAL'
    total.getCell(9).value = { formula: `I${linhaSubtotal}+I${linha - 1}` }
    total.getCell(9).numFmt = MOEDA
    estiloTotal(total)
    linhaTotal = linha
    linha++
  } else {
    const total = ws.getRow(linha)
    total.getCell(4).value = 'TOTAL GERAL'
    total.getCell(9).value = { formula: `I${linhaSubtotal}` }
    total.getCell(9).numFmt = MOEDA
    estiloTotal(total)
    linhaTotal = linha
    linha++
  }

  // Apuracao interna: custo e margem. Nao existe na versao do cliente.
  linha++
  faixaSecao(ws, linha, 9, 'Apuração interna — não enviar ao cliente')
  linha++

  const custo = ws.getRow(linha)
  custo.getCell(4).value = 'Custo total apurado'
  custo.getCell(9).value = centavosParaPlanilha(calculo.totais.custo_total)
  custo.getCell(9).numFmt = MOEDA
  custo.eachCell((c) => (c.border = borda()))
  const linhaCusto = linha
  linha++

  const margem = ws.getRow(linha)
  margem.getCell(4).value = 'Margem'
  margem.getCell(9).value = { formula: `I${linhaTotal}-I${linhaCusto}` }
  margem.getCell(9).numFmt = MOEDA
  margem.eachCell((c) => (c.border = borda()))
  linha++

  const margemPct = ws.getRow(linha)
  margemPct.getCell(4).value = 'Margem (%)'
  margemPct.getCell(9).value = { formula: `IF(I${linhaTotal}=0,0,(I${linhaTotal}-I${linhaCusto})/I${linhaTotal})` }
  margemPct.getCell(9).numFmt = '0.00%'
  margemPct.eachCell((c) => (c.border = borda()))
}

function abaPendencias(wb: ExcelJS.Workbook, pendencias: ItemComPendencia[], ctx: Ctx) {
  const ws = wb.addWorksheet('Pendências', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  })
  ws.columns = [{ width: 45 }, { width: 10 }, { width: 12 }, { width: 45 }]

  cabecalhoDoc(ws, 'Pendências / itens a definir', ctx, 4)

  let linha = 4
  const cab = ws.getRow(linha)
  cab.values = ['Item', 'Unidade', 'Quantidade', 'Observação']
  estiloCabecalhoTabela(cab)
  linha++

  for (const p of pendencias) {
    const r = ws.getRow(linha)
    r.values = [p.descricao, p.unidade ?? '', p.quantidade ?? '', p.observacao ?? '']
    r.eachCell((c) => (c.border = borda()))
    linha++
  }

  linha++
  ws.getCell(linha, 1).value = 'Itens desta aba não integram o total do orçamento.'
  ws.getCell(linha, 1).font = { italic: true, size: 9 }
}

function abaMemorial(wb: ExcelJS.Workbook, orcamento: OrcamentoRow, ctx: Ctx) {
  const ws = wb.addWorksheet('Memorial', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  })
  ws.columns = [{ width: 110 }]

  cabecalhoDoc(ws, 'Memorial descritivo', ctx, 1)

  let linha = 4
  ws.getCell(linha, 1).value = orcamento.titulo ?? ''
  ws.getCell(linha, 1).font = { bold: true, size: 12 }
  linha += 2

  for (const paragrafo of (orcamento.memorial ?? '').split('\n')) {
    const c = ws.getCell(linha, 1)
    c.value = paragrafo
    c.alignment = { wrapText: true, vertical: 'top' }
    linha++
  }

  linha++
  ws.getCell(linha, 1).value = `Data-base: ${formatarData(orcamento.data)}`
  ws.getCell(linha, 1).font = { size: 9, italic: true }
}

function abaPesquisaPrecos(wb: ExcelJS.Workbook, calculo: OrcamentoCalculado, ctx: Ctx) {
  const referenciais = calculo.itens.filter((i) => i.base_referencia !== 'proprio')
  if (referenciais.length === 0) return

  const ws = wb.addWorksheet('Pesquisa de preços', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  })
  ws.columns = [{ width: 12 }, { width: 14 }, { width: 55 }, { width: 10 }, { width: 14 }]

  cabecalhoDoc(ws, 'Pesquisa de preços — composições de referência', ctx, 5)

  let linha = 4
  const cab = ws.getRow(linha)
  cab.values = ['Base', 'Código', 'Descrição', 'Un.', 'Preço unit.']
  estiloCabecalhoTabela(cab)
  linha++

  for (const item of referenciais) {
    const r = ws.getRow(linha)
    r.values = [
      item.base_referencia,
      item.codigo_referencia ?? '',
      item.descricao,
      item.unidade ?? '',
      centavosParaPlanilha(item.preco_base_unitario),
    ]
    r.getCell(5).numFmt = MOEDA
    r.eachCell((c) => (c.border = borda()))
    linha++
  }
}
