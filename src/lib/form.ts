/** Utilitarios de leitura de FormData nos formularios do app (entrada pt-BR). */
import { lerData, lerMoeda, lerNumero, type Centavos, type DataISO } from './format'

export function textoOuNulo(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}

export function textoObrigatorio(v: FormDataEntryValue | null): string {
  return String(v ?? '').trim()
}

export function moedaOuZero(v: FormDataEntryValue | null): Centavos {
  return lerMoeda(String(v ?? '')) ?? 0
}

export function moedaOuNulo(v: FormDataEntryValue | null): Centavos | null {
  return lerMoeda(String(v ?? ''))
}

export function numeroOuNulo(v: FormDataEntryValue | null): number | null {
  return lerNumero(String(v ?? ''))
}

export function dataOuNulo(v: FormDataEntryValue | null): DataISO | null {
  const s = String(v ?? '').trim()
  if (!s) return null
  return lerData(s)
}

export function booleano(v: FormDataEntryValue | null): boolean {
  const s = String(v ?? '').toLowerCase()
  return s === 'on' || s === 'true' || s === '1' || s === 'sim'
}

export interface EstadoForm {
  erro?: string
  ok?: string
}
