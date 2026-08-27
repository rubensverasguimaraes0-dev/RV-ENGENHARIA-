import 'server-only'
import { criarClienteServidor } from '@/lib/supabase/server'
import type { Centavos, DataISO } from '@/lib/format'
import type { CategoriaNota, PagoPor } from '@/lib/domain/tipos'

export interface NotaComFotos {
  id: string
  obra_id: string | null
  local_id: string | null
  semana_id: string | null
  data: DataISO
  fornecedor_id: string | null
  fornecedor_nome: string
  numero_nota: string | null
  categoria: CategoriaNota
  descricao: string
  valor: Centavos
  forma_pagamento: string | null
  pago_por: PagoPor
  conferida: boolean
  repassada_em: DataISO | null
  anotacao_interna: string | null
  a_confirmar: boolean
  qtd_fotos: number
  fotos: { caminho: string; url: string | null }[]
  rateio: { local_id: string | null; valor: Centavos }[]
}

/**
 * Notas da obra, opcionalmente de uma semana, com as fotos ja resolvidas em URL
 * assinada (os buckets sao privados).
 */
export async function listarNotas(
  obraId: string,
  opcoes: { semanaId?: string | null; apenasNaoRepassadas?: boolean } = {},
): Promise<NotaComFotos[]> {
  const supabase = await criarClienteServidor()

  let consulta = supabase
    .from('notas_fiscais')
    .select(
      `id, obra_id, local_id, semana_id, data, fornecedor_id, fornecedor_nome, numero_nota,
       categoria, descricao, valor, forma_pagamento, pago_por, conferida, repassada_em,
       anotacao_interna, a_confirmar,
       fornecedor:fornecedores (nome),
       fotos:fotos_nota (arquivo_url, ordem),
       rateio:rateio_nota (local_id, valor)`,
    )
    .eq('obra_id', obraId)
    .is('excluido_em', null)
    .order('data', { ascending: true })

  if (opcoes.semanaId) consulta = consulta.eq('semana_id', opcoes.semanaId)
  if (opcoes.apenasNaoRepassadas) consulta = consulta.is('repassada_em', null)

  const { data } = await consulta
  const linhas = (data ?? []) as unknown as RowNota[]

  const caminhos = linhas.flatMap((n) =>
    (n.fotos ?? []).filter((f) => !f.arquivo_url.startsWith('http')).map((f) => f.arquivo_url),
  )
  const assinadas = await assinar(caminhos)

  return linhas.map((n) => {
    const fotos = [...(n.fotos ?? [])]
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((f) => ({
        caminho: f.arquivo_url,
        url: f.arquivo_url.startsWith('http') ? f.arquivo_url : assinadas.get(f.arquivo_url) ?? null,
      }))

    return {
      id: n.id,
      obra_id: n.obra_id,
      local_id: n.local_id,
      semana_id: n.semana_id,
      data: n.data,
      fornecedor_id: n.fornecedor_id,
      fornecedor_nome: n.fornecedor?.nome ?? n.fornecedor_nome ?? '',
      numero_nota: n.numero_nota,
      categoria: n.categoria,
      descricao: n.descricao ?? '',
      valor: Number(n.valor ?? 0),
      forma_pagamento: n.forma_pagamento,
      pago_por: n.pago_por,
      conferida: Boolean(n.conferida),
      repassada_em: n.repassada_em,
      anotacao_interna: n.anotacao_interna,
      a_confirmar: Boolean(n.a_confirmar),
      qtd_fotos: fotos.length,
      fotos,
      rateio: (n.rateio ?? []).map((r) => ({ local_id: r.local_id, valor: Number(r.valor ?? 0) })),
    }
  })
}

interface RowNota {
  id: string
  obra_id: string | null
  local_id: string | null
  semana_id: string | null
  data: DataISO
  fornecedor_id: string | null
  fornecedor_nome: string | null
  numero_nota: string | null
  categoria: CategoriaNota
  descricao: string | null
  valor: number
  forma_pagamento: string | null
  pago_por: PagoPor
  conferida: boolean
  repassada_em: DataISO | null
  anotacao_interna: string | null
  a_confirmar: boolean
  fornecedor: { nome: string } | null
  fotos: { arquivo_url: string; ordem: number | null }[] | null
  rateio: { local_id: string | null; valor: number }[] | null
}

/** URLs assinadas do bucket privado de notas, validas por uma hora. */
async function assinar(caminhos: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  const unicos = [...new Set(caminhos)]
  if (unicos.length === 0) return mapa

  const supabase = await criarClienteServidor()
  const { data } = await supabase.storage.from('notas-fiscais').createSignedUrls(unicos, 3600)

  for (const item of data ?? []) {
    if (item.signedUrl && item.path) mapa.set(item.path, item.signedUrl)
  }
  return mapa
}

export interface DespesaRow {
  id: string
  data: DataISO
  descricao: string
  categoria: CategoriaNota
  valor: Centavos
  pago_a: string | null
  repassar_cliente: boolean
  local_id: string | null
}

export async function listarDespesas(
  obraId: string,
  semanaId?: string | null,
): Promise<DespesaRow[]> {
  const supabase = await criarClienteServidor()
  let consulta = supabase
    .from('despesas_sem_nota')
    .select('id, data, descricao, categoria, valor, pago_a, repassar_cliente, local_id')
    .eq('obra_id', obraId)
    .is('excluido_em', null)
    .order('data')

  if (semanaId) consulta = consulta.eq('semana_id', semanaId)

  const { data } = await consulta
  return (data ?? []).map((d) => ({ ...d, valor: Number(d.valor ?? 0) })) as DespesaRow[]
}
