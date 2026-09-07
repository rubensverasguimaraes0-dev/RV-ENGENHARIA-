import 'server-only'
import ExcelJS from 'exceljs'
import type { DadosEmpresa } from '@/lib/parametros'
import { medidasNaFaixa, recuoDoTitulo, type LogoPlanilha } from './logo-planilha'

/**
 * Estilo comum das planilhas geradas pelo app.
 *
 * As cores, fontes e formatos vem do padrao aprovado, em
 * documentos/padrao/relatorios-de-diarias.md e relatorios-de-cliente.md.
 * Nada aqui e escolha de gosto: se um valor mudar, muda tambem no padrao.
 */

// Cores do padrao (ARGB — os dois primeiros digitos sao a opacidade).
export const AZUL = 'FF1F3864' //          NAVY: faixas, cabecalho de tabela, total
export const AZUL_BARRA = 'FF2E5395' //    barra do titulo do documento
export const AZUL_CLARO = 'FFD9E1F2' //    barras de secao
export const AZUL_REALCE = 'FFDCE6F1' //   linha de enfase (parcela balao)
export const AZUL_ESCURO = 'FF1F3864' //   texto sobre fundo claro
export const CINZA_SUBTOTAL = 'FFEDEDED'
export const CINZA_ROTULO = 'FFF2F2F2'
export const CINZA_LINHA = 'FFBFBFBF'
export const VERDE_TOTAL = 'FFC6E0B4' //   totais e gasto geral
export const VERDE_QUITADO = 'FFE2EFDA'
export const TINTA = 'FF262626'
export const VERMELHO_OBS = 'FFC00000' //  observacao do dia
export const AMARELO_PREENCHER = 'FFFFF2CC'
export const TINTA_PREENCHER = 'FF0000FF' // celula que o usuario preenche
export const TINTA_REFERENCIA = 'FF008000' // referencia a outra aba

/**
 * Moeda no padrao brasileiro. O prefixo [$-416] e o que faz o Excel e os
 * conversores para PDF usarem ponto de milhar e virgula decimal — sem ele sai
 * "R$ 67,029.64", no padrao americano.
 */
export const MOEDA = '[$-416]"R$" #,##0.00;-[$-416]"R$" #,##0.00;"-"'
export const DIARIAS = '0.0;-0.0;"-"'
export const INTEIRO = '0;-0;"-"'
export const PERCENTUAL = '[$-416]0.0%'
export const DATA = 'DD/MM/YYYY'

export const FONTE = 'Arial'

export function borda(): Partial<ExcelJS.Borders> {
  const l = { style: 'thin' as const, color: { argb: CINZA_LINHA } }
  return { top: l, left: l, bottom: l, right: l }
}

function bordaMediaAzul(): Partial<ExcelJS.Borders> {
  const l = { style: 'medium' as const, color: { argb: AZUL } }
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
  t.font = { name: FONTE, bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
  // A logo flutua sobre as duas primeiras linhas; o titulo recua para nao
  // ficar por baixo dela. Sem logo, nada muda em relacao ao que ja saia.
  const recuo = ctx.logo ? desenharLogo(ws, ctx.logo) : 0
  t.alignment = { vertical: 'middle', indent: recuo }
  ws.getRow(1).height = 24

  ws.mergeCells(`A2:${ultima}2`)
  const s = ws.getCell('A2')
  s.value = `${ctx.clienteNome} — ${ctx.obraNome}`
  s.font = { name: FONTE, size: 9, color: { argb: AZUL_ESCURO } }
  s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } }
  s.alignment = { vertical: 'middle', indent: recuo }
}

export function estiloCabecalhoTabela(row: ExcelJS.Row) {
  row.height = 28
  row.eachCell((cell) => {
    cell.font = { name: FONTE, bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
    cell.border = borda()
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
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
  c.font = { name: FONTE, bold: true, size: 10, color: { argb: AZUL_ESCURO } }
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } }
  c.border = borda()
  c.alignment = { vertical: 'middle' }
}

export function estiloSubtotal(row: ExcelJS.Row) {
  row.eachCell((c) => {
    c.font = { name: FONTE, bold: true, size: 10 }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA_SUBTOTAL } }
    c.border = borda()
  })
}

/** Total de documento de cliente: faixa navy, texto branco (padrao 4.2). */
export function estiloTotal(row: ExcelJS.Row) {
  row.eachCell((c) => {
    c.font = { name: FONTE, bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
    c.border = borda()
  })
}

/** Total dos relatorios de diaria: verde com borda media azul. */
export function estiloTotalVerde(row: ExcelJS.Row) {
  row.eachCell((c) => {
    c.font = { name: FONTE, bold: true, size: 10, color: { argb: TINTA } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_TOTAL } }
    c.border = bordaMediaAzul()
  })
}

/** Observacao datada, em vermelho itálico, ao pe de um bloco. */
export function linhaObservacao(
  ws: ExcelJS.Worksheet,
  linha: number,
  colunas: number,
  texto: string,
) {
  ws.mergeCells(linha, 1, linha, colunas)
  const c = ws.getCell(linha, 1)
  c.value = texto
  c.font = { name: FONTE, size: 9, italic: true, color: { argb: VERMELHO_OBS } }
  c.alignment = { vertical: 'middle', wrapText: false }
}

/**
 * Acabamento obrigatorio de toda aba: Arial em tudo, sem linhas de grade e
 * area de impressao explicita.
 *
 * A fonte e aplicada no fim porque o ExcelJS nao tem fonte padrao de workbook;
 * quem nao passa `name` herda Calibri. Percorrer as celulas no fecho garante
 * que nenhuma escape, inclusive as escritas por atalho.
 */
export function finalizarAba(ws: ExcelJS.Worksheet, colunas: number) {
  let ultimaLinha = 1
  ws.eachRow({ includeEmpty: false }, (row, numero) => {
    ultimaLinha = numero
    row.eachCell({ includeEmpty: false }, (cell) => {
      const f = cell.font ?? {}
      cell.font = { ...f, name: FONTE, size: f.size ?? 10 }
    })
  })

  ws.views = [{ showGridLines: false }]
  ws.pageSetup = {
    ...ws.pageSetup,
    printArea: `A1:${colunaPorIndice(colunas)}${ultimaLinha}`,
  }
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
