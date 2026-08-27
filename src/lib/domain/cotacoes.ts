/**
 * Base de precos dos fornecedores (spec 5.6 e 6.1), compartilhada entre o
 * modulo solar e o de obras civis.
 *
 * Regras da especificacao:
 *  - cada nova cotacao e um registro novo: o historico nunca e sobrescrito;
 *  - ao montar a cotacao, usar o menor preco vigente de cada item, com opcao de
 *    trocar o fornecedor manualmente;
 *  - sinalizar em vermelho os itens com cotacao vencida ou com mais de 30 dias;
 *  - itens que o fornecedor substituiu por equivalente ficam sinalizados;
 *  - itens que faltaram entram como estimativa, marcados como tal.
 */
import type { Centavos, DataISO } from '@/lib/format'
import { diferencaEmDias } from '@/lib/format'

export interface ItemCotacao {
  id: string
  cotacao_id: string
  categoria: string | null
  marca: string | null
  modelo: string | null
  /** Wp, kW, bitola */
  especificacao: string | null
  unidade: string | null
  quantidade: number | null
  preco_unitario: Centavos
  /** item que faltou na cotacao e entrou por estimativa */
  estimado: boolean
  /** fornecedor trocou por equivalente */
  substituido: boolean
}

export interface CotacaoCabecalho {
  id: string
  fornecedor_id: string
  fornecedor_nome: string
  numero_documento: string | null
  data: DataISO
  vendedor: string | null
  validade: DataISO | null
  condicao_pagamento: string | null
  total: Centavos
  /** cotacao marcada como base para apurar o custo do servico */
  base: boolean
}

export type SituacaoPreco = 'vigente' | 'antigo' | 'vencido'

export interface ItemComSituacao extends ItemCotacao {
  cotacao: CotacaoCabecalho
  situacao: SituacaoPreco
  dias_desde_cotacao: number
}

/**
 * Situacao do preco na data de referencia:
 *  - vencido: passou da validade informada;
 *  - antigo: sem validade, mas com mais de N dias (padrao 30);
 *  - vigente: o resto.
 */
export function situacaoDoPreco(
  cotacao: Pick<CotacaoCabecalho, 'data' | 'validade'>,
  hoje: DataISO,
  diasAlerta = 30,
): SituacaoPreco {
  if (cotacao.validade && cotacao.validade < hoje) return 'vencido'
  if (diferencaEmDias(cotacao.data, hoje) > diasAlerta) return 'antigo'
  return 'vigente'
}

export function comSituacao(
  itens: ItemCotacao[],
  cotacoes: CotacaoCabecalho[],
  hoje: DataISO,
  diasAlerta = 30,
): ItemComSituacao[] {
  const porId = new Map(cotacoes.map((c) => [c.id, c]))

  return itens
    .filter((i) => porId.has(i.cotacao_id))
    .map((i) => {
      const cotacao = porId.get(i.cotacao_id)!
      return {
        ...i,
        cotacao,
        situacao: situacaoDoPreco(cotacao, hoje, diasAlerta),
        dias_desde_cotacao: diferencaEmDias(cotacao.data, hoje),
      }
    })
}

/**
 * Menor preco vigente de cada item, agrupado pela chave do produto.
 *
 * Um preco vencido nunca ganha de um vigente, por mais barato que seja: so
 * entra na comparacao se nao houver nenhum vigente para aquele produto — e
 * nesse caso sai sinalizado.
 */
export function menorPrecoVigente(
  itens: ItemComSituacao[],
): { chave: string; escolhido: ItemComSituacao; alternativas: ItemComSituacao[] }[] {
  const grupos = new Map<string, ItemComSituacao[]>()

  for (const item of itens) {
    const chave = chaveDoProduto(item)
    grupos.set(chave, [...(grupos.get(chave) ?? []), item])
  }

  return [...grupos.entries()]
    .map(([chave, lista]) => {
      const vigentes = lista.filter((i) => i.situacao === 'vigente')
      const candidatos = vigentes.length > 0 ? vigentes : lista
      const ordenados = [...candidatos].sort(
        (a, b) => a.preco_unitario - b.preco_unitario || comparaData(b.cotacao.data, a.cotacao.data),
      )
      return {
        chave,
        escolhido: ordenados[0]!,
        alternativas: [...lista]
          .filter((i) => i.id !== ordenados[0]!.id)
          .sort((a, b) => a.preco_unitario - b.preco_unitario),
      }
    })
    .sort((a, b) => a.chave.localeCompare(b.chave, 'pt-BR'))
}

/** Produto e identificado por marca + modelo + especificacao, sem depender de grafia. */
export function chaveDoProduto(item: Pick<ItemCotacao, 'marca' | 'modelo' | 'especificacao' | 'categoria'>): string {
  return [item.categoria, item.marca, item.modelo, item.especificacao]
    .map((p) => (p ?? '').trim().toUpperCase())
    .filter(Boolean)
    .join(' | ')
}

function comparaData(a: DataISO, b: DataISO): number {
  return a === b ? 0 : a < b ? -1 : 1
}

export interface ComparativoCotacoes {
  chave: string
  descricao: string
  /** preco de cada cotacao para o mesmo produto; null quando a cotacao nao tem o item */
  precos: (Centavos | null)[]
  menor: Centavos | null
  /** indice da cotacao com o menor preco */
  indice_menor: number | null
}

/** Comparativo lado a lado de duas ou mais cotacoes do mesmo escopo (spec 6.1). */
export function compararCotacoes(
  cotacoes: CotacaoCabecalho[],
  itens: ItemCotacao[],
): ComparativoCotacoes[] {
  const chaves = new Map<string, ItemCotacao>()
  for (const item of itens) {
    const chave = chaveDoProduto(item)
    if (!chaves.has(chave)) chaves.set(chave, item)
  }

  return [...chaves.entries()]
    .map(([chave, exemplo]) => {
      const precos = cotacoes.map((c) => {
        const item = itens.find((i) => i.cotacao_id === c.id && chaveDoProduto(i) === chave)
        return item ? item.preco_unitario : null
      })
      const validos = precos.filter((p): p is Centavos => p !== null)
      const menor = validos.length > 0 ? Math.min(...validos) : null

      return {
        chave,
        descricao: [exemplo.marca, exemplo.modelo, exemplo.especificacao].filter(Boolean).join(' '),
        precos,
        menor,
        indice_menor: menor === null ? null : precos.findIndex((p) => p === menor),
      }
    })
    .sort((a, b) => a.chave.localeCompare(b.chave, 'pt-BR'))
}

/** Total da cotacao pelos itens, para conferir com o total informado no documento. */
export function totalDaCotacao(itens: ItemCotacao[]): Centavos {
  return itens.reduce((s, i) => s + Math.round((i.quantidade ?? 1) * i.preco_unitario), 0)
}
