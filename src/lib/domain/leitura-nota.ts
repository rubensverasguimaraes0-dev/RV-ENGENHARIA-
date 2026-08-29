/**
 * O que a leitura automatica devolve, depois de conferida.
 *
 * A IA le a foto da nota e devolve um objeto. Este modulo e a alfandega entre
 * o que ela DIZ e o que o formulario ACEITA: cada campo passa por validacao, e
 * o que nao passar vira nulo — campo vazio para a pessoa preencher, nunca um
 * palpite gravado como se fosse dado.
 *
 * Nada daqui salva nada. A leitura so preenche o formulario; quem decide
 * continua sendo quem confere e aperta "Lancar nota".
 */
import { ehDataISO, lerData, lerMoeda, type Centavos, type DataISO } from '@/lib/format'
import type { CategoriaNota } from './tipos'

export interface LeituraNota {
  fornecedor: string | null
  cnpj: string | null
  numero_nota: string | null
  data: DataISO | null
  valor: Centavos | null
  categoria: CategoriaNota | null
  descricao: string | null
  forma_pagamento: string | null
}

const CATEGORIAS: CategoriaNota[] = [
  'material',
  'locacao',
  'cacamba',
  'terceiro',
  'combustivel',
  'outro',
]

const FORMAS = ['pix', 'dinheiro', 'cartão', 'transferência', 'boleto', 'prazo']

// "não identificado" e parentes: a IA avisando que nao achou. Compara a
// FRASE INTEIRA — comparar so o comeco derrubava fornecedor de verdade, como
// "Semar Supermercado" ou "Sempre Forte Ferragens".
const SENTINELAS =
  /^(n[aã]o (identificad[oa]|informad[oa]|consta|leg[ií]vel|dispon[ií]vel)|sem (valor|nome|n[uú]mero|dados|informa[cç][aã]o)|ileg[ií]vel|desconhecid[oa]|indispon[ií]vel|n\/?[ad]|-+|\?+)$/i

function texto(v: unknown): string | null {
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
 * vezes a nota. A regra desta funcao: quando ha ponto E virgula, o decimal e o
 * que vem POR ULTIMO; ponto sozinho seguido de 1 ou 2 digitos no fim e
 * decimal; o resto segue o lerMoeda.
 */
function dinheiro(v: unknown): Centavos | null {
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
        : s.replace(/,/g, '') // "1,234.56" — tira o milhar e o ponto vira decimal abaixo
  }
  if (normalizado.includes('.') && !normalizado.includes(',')) {
    const decimalComPonto = /^\d+\.\d{1,2}$/.test(normalizado)
    // "476.40" e decimal (milhar tem sempre 3 digitos); "1.234" e milhar.
    normalizado = decimalComPonto ? normalizado.replace('.', ',') : normalizado
  }

  const c = lerMoeda(normalizado)
  return c !== null && c > 0 ? c : null
}

function dataDaNota(v: unknown): DataISO | null {
  if (typeof v !== 'string') return null
  const limpo = v.trim()
  const iso = ehDataISO(limpo) ? limpo : lerData(limpo)
  if (!iso) return null
  // O formato aaaa-mm-dd aceita "2026-31-12"; o calendario nao. Sem esta
  // checagem, a data invalida preenchia o campo e anulava o padrao de hoje.
  const [ano, mes, dia] = iso.split('-').map(Number)
  if (!ano || !mes || !dia || ano < 2000 || ano > 2100) return null
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null
  return iso
}

/**
 * Interpreta o que a IA devolveu. Aceita qualquer coisa na entrada — inclusive
 * lixo — e devolve sempre um objeto completo, com nulo onde nao deu.
 */
export function interpretarLeitura(bruto: unknown): LeituraNota {
  const b = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>

  const categoria = typeof b.categoria === 'string' ? b.categoria.toLowerCase().trim() : ''
  const forma = typeof b.forma_pagamento === 'string' ? b.forma_pagamento.toLowerCase().trim() : ''

  return {
    fornecedor: texto(b.fornecedor),
    cnpj: texto(b.cnpj),
    numero_nota: texto(b.numero_nota),
    data: dataDaNota(b.data),
    valor: dinheiro(b.valor),
    categoria: (CATEGORIAS as string[]).includes(categoria)
      ? (categoria as CategoriaNota)
      : null,
    descricao: texto(b.descricao),
    forma_pagamento: FORMAS.includes(forma) ? forma : null,
  }
}

/**
 * Procura o fornecedor lido entre os ja cadastrados.
 *
 * Comparacao frouxa de proposito: a nota diz "COMERCIAL FERRAGENS LTDA" e o
 * cadastro diz "Comercial Ferragens". Sem acento, sem caixa, e basta um conter
 * o outro. Empate ou nada: devolve nulo e a pessoa escolhe.
 */
export function acharFornecedor(
  nomeLido: string | null,
  cadastrados: { id: string; nome: string }[],
): string | null {
  if (!nomeLido) return null
  const chave = simplificar(nomeLido)
  if (chave.length < 3) return null

  const iguais = cadastrados.filter((f) => {
    const c = simplificar(f.nome)
    return c.length >= 3 && (c.includes(chave) || chave.includes(c))
  })
  return iguais.length === 1 ? (iguais[0]?.id ?? null) : null
}

function simplificar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(ltda|me|epp|sa|s\/a|eireli|comercio|com)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Resumo do que foi lido, para a pessoa ver o que veio antes de conferir. */
export function resumoDaLeitura(l: LeituraNota): string {
  const lidos = [
    l.valor !== null && 'valor',
    l.data && 'data',
    l.fornecedor && 'fornecedor',
    l.numero_nota && 'número',
    l.categoria && 'categoria',
    l.descricao && 'descrição',
  ].filter(Boolean)
  if (lidos.length === 0) return 'Não deu para ler nada com segurança nesta foto.'
  return `Lidos da foto: ${lidos.join(', ')}. Confira antes de lançar — a leitura ajuda, não decide.`
}
