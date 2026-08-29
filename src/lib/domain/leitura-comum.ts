/**
 * O que toda leitura por IA tem em comum, seja de nota fiscal ou de conta de
 * energia: transformar o que o modelo DISSE em dado que o formulario ACEITA.
 * Campo que nao valida vira nulo — vazio para a pessoa preencher, nunca um
 * palpite gravado como se fosse dado.
 */
import { lerMoeda, type Centavos } from '@/lib/format'

// "não identificado" e parentes: a IA avisando que nao achou. Compara a
// FRASE INTEIRA — comparar so o comeco derrubava fornecedor de verdade, como
// "Semar Supermercado" ou "Sempre Forte Ferragens".
const SENTINELAS =
  /^(n[aã]o (identificad[oa]|informad[oa]|consta|leg[ií]vel|dispon[ií]vel)|sem (valor|nome|n[uú]mero|dados|informa[cç][aã]o)|ileg[ií]vel|desconhecid[oa]|indispon[ií]vel|n\/?[ad]|-+|\?+)$/i

export function textoDaLeitura(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const limpo = v.trim()
  if (!limpo || SENTINELAS.test(limpo)) return null
  return limpo
}

/**
 * Dinheiro vindo da IA, que nao digita como brasileiro: pode vir "476,40",
 * "476.40", "1.234,56", "1,234.56" ou o numero 476.4.
 *
 * O lerMoeda sozinho nao serve aqui: ele foi escrito para digitacao pt-BR e
 * trata todo ponto como separador de milhar — "476.40" virava 47.640,00, cem
 * vezes a nota. A regra: com ponto E virgula, o decimal e o que vem POR
 * ULTIMO; ponto sozinho seguido de 1 ou 2 digitos no fim e decimal; o resto
 * segue o lerMoeda.
 */
export function dinheiroDaLeitura(v: unknown): Centavos | null {
  if (typeof v === 'number') {
    return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null
  }
  if (typeof v !== 'string') return null

  const s = v.replace(/[R$\s]/gi, '')
  if (!s) return null

  let normalizado = s
  const ultimoPonto = s.lastIndexOf('.')
  const ultimaVirgula = s.lastIndexOf(',')

  if (ultimoPonto >= 0 && ultimaVirgula >= 0) {
    // Os dois presentes: o decimal e o que vem por ultimo.
    normalizado =
      ultimaVirgula > ultimoPonto
        ? s // "1.234,56" — ja e pt-BR
        : s.replace(/,/g, '') // "1,234.56" — tira o milhar; o ponto vira decimal abaixo
  }
  if (normalizado.includes('.') && !normalizado.includes(',')) {
    const partes = normalizado.split('.')
    const inteiro = partes[0] ?? ''
    const fracao = partes[1] ?? ''
    // Um ponto so, e o grupo depois dele NAO tem exatamente 3 digitos: e
    // decimal, porque grupo de milhar tem sempre 3. "476.40" e decimal;
    // "1.234" e milhar. E parte inteira "0" nunca e milhar: "0.867459", a
    // tarifa impressa com seis casas, e sempre decimal — antes virava
    // R$ 8.674,59 e o campo saia vazio pela regua de plausibilidade.
    const decimalComPonto = partes.length === 2 && (fracao.length !== 3 || inteiro === '0')
    normalizado = decimalComPonto ? `${inteiro},${fracao}` : normalizado
  }

  const c = lerMoeda(normalizado)
  return c !== null && c > 0 ? c : null
}

/**
 * Numero simples (kWh, quantidade) com as mesmas manhas de separador:
 * "512", "512,5", "1.234" (milhar) e 512.5 valem; lixo vira nulo.
 */
export function numeroDaLeitura(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null
  if (typeof v !== 'string') return null
  const centavos = dinheiroDaLeitura(v)
  return centavos !== null ? centavos / 100 : null
}
