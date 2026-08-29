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
import { ehDataISO, lerData, type Centavos, type DataISO } from '@/lib/format'
import { dinheiroDaLeitura, textoDaLeitura } from './leitura-comum'
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
    fornecedor: textoDaLeitura(b.fornecedor),
    cnpj: textoDaLeitura(b.cnpj),
    numero_nota: textoDaLeitura(b.numero_nota),
    data: dataDaNota(b.data),
    valor: dinheiroDaLeitura(b.valor),
    categoria: (CATEGORIAS as string[]).includes(categoria)
      ? (categoria as CategoriaNota)
      : null,
    descricao: textoDaLeitura(b.descricao),
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
