import 'server-only'
import ExcelJS from 'exceljs'
import type { ResumoAlmoxarifado } from '@/lib/domain/almoxarifado'
import { centavosParaPlanilha } from '@/lib/format'
import type { DadosEmpresa } from '@/lib/parametros'
import { AZUL, AZUL_CLARO, AZUL_ESCURO, MOEDA, borda, cabecalhoDoc, estiloCabecalhoTabela, faixaSecao } from './estilo-planilha'

/**
 * Almoxarifado em xlsx (spec 4.10): planilha enxuta, pronta para A4, agrupada
 * por categoria e com todos os totais por formula (regra 11.2).
 * O custo unitario nao entra: a planilha e a que vai ao cliente.
 */
export async function gerarPlanilhaAlmoxarifado(opcoes: {
  resumo: ResumoAlmoxarifado
  empresa: DadosEmpresa
  obraNome: string
  clienteNome: string
}): Promise<Buffer> {
  const { resumo, empresa, obraNome, clienteNome } = opcoes

  const wb = new ExcelJS.Workbook()
  wb.creator = empresa.nome
  wb.created = new Date()

  const ws = wb.addWorksheet('Almoxarifado', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  })
  ws.columns = [{ width: 38 }, { width: 10 }, { width: 13 }, { width: 12 }, { width: 12 }, { width: 15 }]

  cabecalhoDoc(ws, 'Material em obra — almoxarifado', { empresa, obraNome, clienteNome }, 6)

  let linha = 4
  const linhasDeTotalPorCategoria: number[] = []

  for (const grupo of resumo.grupos) {
    faixaSecao(ws, linha, 6, grupo.categoria)
    linha++

    const cab = ws.getRow(linha)
    cab.values = ['Descrição', 'Unidade', 'Quantidade', 'Saídas', 'Saldo', 'Valor cobrado']
    estiloCabecalhoTabela(cab)
    linha++

    const primeira = linha
    for (const item of grupo.itens) {
      const r = ws.getRow(linha)
      r.getCell(1).value = item.cor_bitola ? `${item.descricao} — ${item.cor_bitola}` : item.descricao
      r.getCell(2).value = item.unidade ?? ''
      r.getCell(3).value = item.quantidade === null ? 'a contar' : item.quantidade
      r.getCell(4).value = item.total_saidas
      // saldo por formula: quantidade - saidas
      r.getCell(5).value =
        item.quantidade === null ? '' : { formula: `IF(ISNUMBER(C${linha}),C${linha}-D${linha},"")` }
      r.getCell(6).value = centavosParaPlanilha(item.valor_cobrado)
      r.getCell(6).numFmt = MOEDA
      r.eachCell((c) => (c.border = borda()))
      linha++
    }
    const ultima = linha - 1

    const total = ws.getRow(linha)
    total.getCell(1).value = `Subtotal ${grupo.categoria}`
    total.getCell(6).value =
      grupo.itens.length > 0 ? { formula: `SUM(F${primeira}:F${ultima})` } : 0
    total.getCell(6).numFmt = MOEDA
    total.eachCell((c) => {
      c.font = { bold: true }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F7FB' } }
      c.border = borda()
    })
    linhasDeTotalPorCategoria.push(linha)
    linha++

    // subtotais por cor e bitola (cabos)
    for (const s of grupo.subgrupos) {
      const r = ws.getRow(linha)
      r.getCell(1).value = `Subtotal ${s.cor_bitola} — ${s.quantidade_pedacos} pedaço(s)`
      r.getCell(3).value = s.metragem_total
      r.getCell(4).value = Math.round((s.metragem_total - s.metragem_restante) * 10000) / 10000
      r.getCell(5).value = { formula: `C${linha}-D${linha}` }
      r.eachCell((c) => {
        c.font = { italic: true, size: 10 }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } }
        c.border = borda()
      })
      linha++
    }

    linha++
  }

  const totalGeral = ws.getRow(linha)
  totalGeral.getCell(1).value = 'TOTAL DO MATERIAL COBRADO'
  totalGeral.getCell(6).value =
    linhasDeTotalPorCategoria.length > 0
      ? { formula: linhasDeTotalPorCategoria.map((l) => `F${l}`).join('+') }
      : 0
  totalGeral.getCell(6).numFmt = MOEDA
  totalGeral.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ESCURO } }
    c.border = borda()
  })

  if (resumo.itens_sem_quantidade > 0) {
    linha += 2
    ws.getCell(linha, 1).value = `${resumo.itens_sem_quantidade} item(ns) sem quantidade definida, a conferir na obra.`
    ws.getCell(linha, 1).font = { size: 9, italic: true, color: { argb: AZUL } }
  }

  return Buffer.from(await wb.xlsx.writeBuffer())
}
