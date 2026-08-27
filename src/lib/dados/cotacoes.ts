import 'server-only'
import { criarClienteServidor } from '@/lib/supabase/server'
import {
  comSituacao,
  menorPrecoVigente,
  totalDaCotacao,
  type CotacaoCabecalho,
  type ItemCotacao,
  type ItemComSituacao,
} from '@/lib/domain/cotacoes'
import { hojeISO } from '@/lib/format'

function normalizarCotacao(row: Record<string, unknown>): CotacaoCabecalho {
  const fornecedor = Array.isArray(row.fornecedor) ? row.fornecedor[0] : row.fornecedor
  return {
    id: row.id as string,
    fornecedor_id: row.fornecedor_id as string,
    fornecedor_nome: (fornecedor as { nome?: string } | null)?.nome ?? '—',
    numero_documento: (row.numero_documento as string) ?? null,
    data: row.data as string,
    vendedor: (row.vendedor as string) ?? null,
    validade: (row.validade as string) ?? null,
    condicao_pagamento: (row.condicao_pagamento as string) ?? null,
    total: Number(row.total ?? 0),
    base: Boolean(row.base),
  }
}

const CAMPOS =
  'id, fornecedor_id, numero_documento, data, vendedor, validade, condicao_pagamento, total, base, fornecedor:fornecedores (nome)'

export async function listarCotacoes(): Promise<CotacaoCabecalho[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('cotacoes')
    .select(CAMPOS)
    .is('excluido_em', null)
    .order('data', { ascending: false })
  return (data ?? []).map((c) => normalizarCotacao(c as Record<string, unknown>))
}

export async function carregarCotacao(
  cotacaoId: string,
): Promise<{ cotacao: CotacaoCabecalho; itens: ItemCotacao[]; total_calculado: number } | null> {
  const supabase = await criarClienteServidor()

  const { data } = await supabase
    .from('cotacoes')
    .select(CAMPOS)
    .eq('id', cotacaoId)
    .is('excluido_em', null)
    .maybeSingle()

  if (!data) return null

  const { data: itensData } = await supabase
    .from('itens_cotacao')
    .select(
      'id, cotacao_id, categoria, marca, modelo, especificacao, unidade, quantidade, preco_unitario, estimado, substituido',
    )
    .eq('cotacao_id', cotacaoId)
    .is('excluido_em', null)
    .order('categoria')

  const itens = (itensData ?? []).map((i) => ({
    ...i,
    quantidade: i.quantidade === null ? null : Number(i.quantidade),
    preco_unitario: Number(i.preco_unitario ?? 0),
  })) as ItemCotacao[]

  return {
    cotacao: normalizarCotacao(data as Record<string, unknown>),
    itens,
    total_calculado: totalDaCotacao(itens),
  }
}

/**
 * Base de precos consolidada: cada produto com o menor preco vigente e as
 * alternativas, para trocar o fornecedor na mao.
 */
export async function carregarBaseDePrecos(categoria?: string): Promise<{
  grupos: ReturnType<typeof menorPrecoVigente>
  cotacoes: CotacaoCabecalho[]
  todos: ItemComSituacao[]
}> {
  const supabase = await criarClienteServidor()

  const [cotacoes, { data: parametro }] = await Promise.all([
    listarCotacoes(),
    supabase.from('parametros').select('valor').eq('chave', 'cotacao_dias_alerta').maybeSingle(),
  ])

  if (cotacoes.length === 0) return { grupos: [], cotacoes: [], todos: [] }

  let consulta = supabase
    .from('itens_cotacao')
    .select(
      'id, cotacao_id, categoria, marca, modelo, especificacao, unidade, quantidade, preco_unitario, estimado, substituido',
    )
    .in(
      'cotacao_id',
      cotacoes.map((c) => c.id),
    )
    .is('excluido_em', null)

  if (categoria) consulta = consulta.eq('categoria', categoria)

  const { data: itensData } = await consulta
  const itens = (itensData ?? []).map((i) => ({
    ...i,
    quantidade: i.quantidade === null ? null : Number(i.quantidade),
    preco_unitario: Number(i.preco_unitario ?? 0),
  })) as ItemCotacao[]

  const diasAlerta = Number(parametro?.valor ?? 30) || 30
  const todos = comSituacao(itens, cotacoes, hojeISO(), diasAlerta)

  return { grupos: menorPrecoVigente(todos), cotacoes, todos }
}
