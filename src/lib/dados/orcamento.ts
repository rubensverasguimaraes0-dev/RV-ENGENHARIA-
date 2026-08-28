import 'server-only'
import { criarClienteServidor } from '@/lib/supabase/server'
import {
  calcularOrcamento,
  type ItemOrcamento,
  type OrcamentoCalculado,
} from '@/lib/domain/orcamento'
import type { ModoBdi } from '@/lib/domain/tipos'
import type { Centavos, DataISO } from '@/lib/format'

export interface OrcamentoRow {
  id: string
  obra_id: string | null
  cliente_id: string | null
  numero: string | null
  titulo: string | null
  tipo: 'rapido' | 'completo'
  bdi: number
  margem: number
  modo_bdi: ModoBdi
  data: DataISO
  validade: DataISO | null
  condicoes: Record<string, string>
  memorial: string | null
  total: Centavos
}

function normalizar(row: Record<string, unknown>): OrcamentoRow {
  return {
    id: row.id as string,
    obra_id: (row.obra_id as string) ?? null,
    cliente_id: (row.cliente_id as string) ?? null,
    numero: (row.numero as string) ?? null,
    titulo: (row.titulo as string) ?? null,
    tipo: (row.tipo as 'rapido' | 'completo') ?? 'rapido',
    bdi: Number(row.bdi ?? 0),
    margem: Number(row.margem ?? 0.3),
    modo_bdi: (row.modo_bdi as ModoBdi) ?? 'embutido',
    data: row.data as DataISO,
    validade: (row.validade as DataISO) ?? null,
    condicoes:
      row.condicoes_json && typeof row.condicoes_json === 'object'
        ? (row.condicoes_json as Record<string, string>)
        : {},
    memorial: (row.memorial as string) ?? null,
    total: Number(row.total ?? 0),
  }
}

const CAMPOS =
  'id, obra_id, cliente_id, numero, titulo, tipo, bdi, margem, modo_bdi, data, validade, condicoes_json, memorial, total'

export async function listarOrcamentos(obraId: string): Promise<OrcamentoRow[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('orcamentos')
    .select(CAMPOS)
    .eq('obra_id', obraId)
    .is('excluido_em', null)
    .order('data', { ascending: false })
  return (data ?? []).map(normalizar)
}

export interface ItemComPendencia extends ItemOrcamento {
  pendencia: boolean
  observacao: string | null
}

export async function carregarOrcamento(orcamentoId: string): Promise<{
  orcamento: OrcamentoRow
  itens: ItemComPendencia[]
  calculo: OrcamentoCalculado
  pendencias: ItemComPendencia[]
} | null> {
  const supabase = await criarClienteServidor()

  const { data: cabecalho } = await supabase
    .from('orcamentos')
    .select(CAMPOS)
    .eq('id', orcamentoId)
    .is('excluido_em', null)
    .maybeSingle()

  if (!cabecalho) return null
  const orcamento = normalizar(cabecalho)

  const { data: itensData } = await supabase
    .from('itens_orcamento')
    .select(
      'id, fase, codigo_referencia, base_referencia, referencia_data_base, referencia_desonerado, descricao, unidade, quantidade, custo_material, custo_mao_obra, preco_unitario, terceirizado_sem_valor, ordem, pendencia, observacao',
    )
    .eq('orcamento_id', orcamentoId)
    .is('excluido_em', null)
    .order('ordem')

  const itens = (itensData ?? []).map((i) => ({
    ...i,
    quantidade: i.quantidade === null ? null : Number(i.quantidade),
    custo_material: i.custo_material === null ? null : Number(i.custo_material),
    custo_mao_obra: i.custo_mao_obra === null ? null : Number(i.custo_mao_obra),
    preco_unitario: i.preco_unitario === null ? null : Number(i.preco_unitario),
    ordem: Number(i.ordem ?? 0),
    pendencia: Boolean(i.pendencia),
  })) as ItemComPendencia[]

  // Item marcado como pendencia sai na aba de pendencias e nao entra no total.
  const noTotal = itens.filter((i) => !i.pendencia)

  return {
    orcamento,
    itens,
    pendencias: itens.filter((i) => i.pendencia),
    calculo: calcularOrcamento(noTotal, {
      margem: orcamento.margem,
      bdi: orcamento.bdi,
      modo_bdi: orcamento.modo_bdi,
    }),
  }
}

export interface PrecoReferencia {
  id: string
  base: string
  codigo: string
  descricao: string
  unidade: string | null
  preco_unitario: Centavos
  data_base: DataISO | null
  uf: string | null
}

export async function buscarPrecosReferencia(termo: string, limite = 20): Promise<PrecoReferencia[]> {
  const supabase = await criarClienteServidor()
  let consulta = supabase
    .from('precos_referencia')
    .select('id, base, codigo, descricao, unidade, preco_unitario, data_base, uf')
    .is('excluido_em', null)
    .order('data_base', { ascending: false })
    .limit(limite)

  if (termo.trim()) {
    const t = termo.trim()
    consulta = consulta.or(`descricao.ilike.%${t}%,codigo.ilike.%${t}%`)
  }

  const { data } = await consulta
  return (data ?? []).map((p) => ({
    ...p,
    preco_unitario: Number(p.preco_unitario ?? 0),
  })) as PrecoReferencia[]
}
