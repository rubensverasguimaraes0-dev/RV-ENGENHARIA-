/**
 * Formatacao pt-BR do app: datas dd/mm/aaaa, decimal com virgula, moeda em Real.
 *
 * Dinheiro circula pelo app como inteiro em centavos. Isso evita o erro de
 * ponto flutuante que apareceria justamente onde nao pode aparecer: no total
 * de um relatorio enviado ao cliente.
 */

export type Centavos = number

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * R$ 1.234,56
 *
 * O Intl separa o simbolo com espaco nao separavel (U+00A0). Ele e trocado por
 * espaco comum: os valores vao para PDF, planilha e WhatsApp, e o NBSP aparece
 * como caractere estranho em varios desses destinos.
 */
export function formatarMoeda(centavos: Centavos): string {
  return BRL.format(centavos / 100).replace(/\u00a0/g, ' ')
}

/** 1.234,56 — sem o simbolo, para colunas de planilha */
export function formatarValor(centavos: Centavos): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** 101,94 — quantidades com casas variaveis (m2, m linear, unidade) */
export function formatarNumero(valor: number, casas = 2): string {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
}

export function formatarPercentual(fracao: number, casas = 2): string {
  return `${formatarNumero(fracao * 100, casas)}%`
}

/**
 * Le um valor digitado em pt-BR ("1.234,56", "1234,56", "R$ 12,00") e devolve
 * centavos. Devolve null quando o texto nao e um numero valido.
 */
export function lerMoeda(texto: string | number | null | undefined): Centavos | null {
  if (texto === null || texto === undefined || texto === '') return null
  if (typeof texto === 'number') {
    return Number.isFinite(texto) ? Math.round(texto * 100) : null
  }
  const limpo = texto
    .replace(/\s/g, '')
    .replace(/^R\$/i, '')
    .replace(/\./g, '')
    .replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(limpo)) return null
  return Math.round(Number(limpo) * 100)
}

/** Le uma quantidade em pt-BR ("101,94") e devolve number. */
export function lerNumero(texto: string | number | null | undefined): number | null {
  if (texto === null || texto === undefined || texto === '') return null
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null
  const limpo = texto.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(limpo)) return null
  return Number(limpo)
}

/** Multiplica centavos por uma fracao arredondando ao centavo (meia diaria, margem, BDI). */
export function aplicarFator(centavos: Centavos, fator: number): Centavos {
  return Math.round(centavos * fator)
}

/** Converte centavos para o numero que vai na celula da planilha (12,34 => 12.34). */
export function centavosParaPlanilha(centavos: Centavos): number {
  return centavos / 100
}

// ---------------------------------------------------------------------------
// Datas — o app trafega datas como 'aaaa-mm-dd' (date do Postgres, sem fuso).
// Nunca usar new Date('2026-08-27') para exibir: isso vira UTC e volta um dia.
// ---------------------------------------------------------------------------

export type DataISO = string // aaaa-mm-dd

const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

export function ehDataISO(valor: string): valor is DataISO {
  return RE_ISO.test(valor)
}

/** 2026-08-27 => 27/08/2026 */
export function formatarData(iso: DataISO): string {
  const m = RE_ISO.exec(iso)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}

/** 27/08/2026 => 2026-08-27 */
export function lerData(texto: string): DataISO | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim())
  if (!m) return ehDataISO(texto.trim()) ? texto.trim() : null
  return `${m[3]}-${m[2]}-${m[1]}`
}

export function hojeISO(agora = new Date()): DataISO {
  const y = agora.getFullYear()
  const m = String(agora.getMonth() + 1).padStart(2, '0')
  const d = String(agora.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Data ISO -> Date em UTC ao meio-dia, seguro para aritmetica de dias. */
function paraDate(iso: DataISO): Date {
  const m = RE_ISO.exec(iso)
  if (!m) throw new Error(`Data invalida: ${iso}`)
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12))
}

function paraISO(d: Date): DataISO {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`
}

export function somarDias(iso: DataISO, dias: number): DataISO {
  const d = paraDate(iso)
  d.setUTCDate(d.getUTCDate() + dias)
  return paraISO(d)
}

export function diferencaEmDias(de: DataISO, ate: DataISO): number {
  return Math.round((paraDate(ate).getTime() - paraDate(de).getTime()) / 86_400_000)
}

/** 0 = domingo, 1 = segunda ... 6 = sabado */
export function diaDaSemana(iso: DataISO): number {
  return paraDate(iso).getUTCDay()
}

export function ehSabado(iso: DataISO): boolean {
  return diaDaSemana(iso) === 6
}

export function ehDomingo(iso: DataISO): boolean {
  return diaDaSemana(iso) === 0
}

const NOMES_DIA = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'] as const

export function nomeDoDia(iso: DataISO): string {
  return NOMES_DIA[diaDaSemana(iso)] ?? ''
}

const NOMES_MES = [
  'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
] as const

/**
 * 2026-07-23 => JULHO/2026, para a faixa de mes do cronograma.
 *
 * Le o mes direto do texto, sem passar por Date: `new Date('2026-07-01')` e
 * meia-noite em UTC, que no fuso de Teresina cai no dia 30 de junho — e a
 * faixa sairia com o mes errado justamente na virada.
 */
export function nomeDoMes(iso: DataISO): string {
  const m = RE_ISO.exec(iso)
  if (!m) return iso
  return `${NOMES_MES[Number(m[2]) - 1] ?? ''}/${m[1]}`
}

/** Segunda-feira da semana que contem a data. */
export function segundaDaSemana(iso: DataISO): DataISO {
  const dow = diaDaSemana(iso)
  // domingo (0) pertence a semana que comeca no dia seguinte
  const recuo = dow === 0 ? -1 : dow - 1
  return somarDias(iso, -recuo)
}

/** Lista de datas de segunda a sabado a partir da segunda informada. */
export function diasDaSemana(segunda: DataISO): DataISO[] {
  return Array.from({ length: 6 }, (_, i) => somarDias(segunda, i))
}

export function formatarDataHora(valor: string | Date): string {
  const d = typeof valor === 'string' ? new Date(valor) : valor
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
