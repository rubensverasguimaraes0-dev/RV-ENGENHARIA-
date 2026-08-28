import 'server-only'
import ExcelJS from 'exceljs'
import type { DadosEmpresa } from '@/lib/parametros'
import { medidasNaFaixa, recuoDoTitulo, type LogoPlanilha } from './logo-planilha'

/**
 * Estilo comum das planilhas geradas pelo app: tabelas com secoes, coloridas,
 * densas e prontas para A4 (spec 12). Fica aqui para que toda planilha do
 * sistema saia com a mesma cara.
 */

export const AZUL = 'FF0B4F8A'
export const AZUL_CLARO = 'FFE3EEFB'
export const AZUL_ESCURO = 'FF073457'
export const CINZA_SUBTOTAL = 'FFF4F7FB'
export const MOEDA = 'R$ #,##0.00'

export function borda(): Partial<ExcelJS.Borders> {
  const l = { style: 'thin' as const, color: { argb: 'FFB9CADB' } }
  return { top: l, left: l, bottom: l, right: l }
}

export interface ContextoDoc {
  empresa: DadosEmpresa
  obraNome: string
  clienteNome: string
  /** Logo ja baixada pelo gerador. Ausente quando nao ha logo configurada. */
  logo?: LogoPlanilha | null
}

/**
 * Desenha a logo sobre a faixa do cabecalho e devolve o recuo que o titulo
 * precisa. A imagem entra no workbook uma unica vez, mesmo com varias abas.
 */
function desenharLogo(ws: ExcelJS.Worksheet, logo: LogoPlanilha): number {
  if (logo.idNoWorkbook === undefined) {
    logo.idNoWorkbook = ws.workbook.addImage({
      buffer: logo.dados as unknown as ExcelJS.Buffer,
      extension: logo.formato,
    })
  }
  const { largura, altura } = medidasNaFaixa(logo)
  ws.addImage(logo.idNoWorkbook, {
    tl: { col: 0.15, row: 0.1 },
    ext: { width: largura, height: altura },
    editAs: 'oneCell',
  })
  return recuoDoTitulo(logo)
}

/** Duas primeiras linhas de toda planilha: empresa + titulo, cliente + obra. */
export function cabecalhoDoc(
  ws: ExcelJS.Worksheet,
  titulo: string,
  ctx: ContextoDoc,
  colunas: number,
) {
  const ultima = colunaPorIndice(colunas)

  ws.mergeCells(`A1:${ultima}1`)
  const t = ws.getCell('A1')
  t.value = `${ctx.empresa.nome} — ${titulo}`
  t.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
  // A logo flutua sobre as duas primeiras linhas; o titulo recua para nao
  // ficar por baixo dela. Sem logo, nada muda em relacao ao que ja saia.
  const recuo = ctx.logo ? desenharLogo(ws, ctx.logo) : 0
  t.alignment = { vertical: 'middle', indent: recuo }
  ws.getRow(1).height = 22

  ws.mergeCells(`A2:${ultima}2`)
  const s = ws.getCell('A2')
  s.value = `${ctx.clienteNome} — ${ctx.obraNome}`
  s.font = { size: 10, color: { argb: AZUL_ESCURO } }
  s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } }
  s.alignment = { indent: recuo }
}

export function estiloCabecalhoTabela(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
    cell.border = borda()
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
}

/** Faixa de categoria/secao dentro da tabela. */
export function faixaSecao(
  ws: ExcelJS.Worksheet,
  linha: number,
  colunas: number,
  texto: string,
) {
  ws.mergeCells(linha, 1, linha, colunas)
  const c = ws.getCell(linha, 1)
  c.value = texto
  c.font = { bold: true, size: 10, color: { argb: AZUL_ESCURO } }
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } }
  c.border = borda()
}

export function estiloSubtotal(row: ExcelJS.Row) {
  row.eachCell((c) => {
    c.font = { bold: true }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA_SUBTOTAL } }
    c.border = borda()
  })
}

export function estiloTotal(row: ExcelJS.Row) {
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ESCURO } }
    c.border = borda()
  })
}

/** 1 => A, 27 => AA. Evita o bug de String.fromCharCode acima da coluna Z. */
export function colunaPorIndice(indice: number): string {
  let n = indice
  let nome = ''
  while (n > 0) {
    const resto = (n - 1) % 26
    nome = String.fromCharCode(65 + resto) + nome
    n = Math.floor((n - 1) / 26)
  }
  return nome
}

/** Nome de aba valido: o Excel recusa alguns caracteres e mais de 31 letras. */
export function nomeDeAba(texto: string): string {
  return texto.replace(/[\\/*?:[\]]/g, '-').slice(0, 31)
}

/** Nome de arquivo sem acento nem espaco, para o Content-Disposition. */
export function nomeDeArquivo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}
