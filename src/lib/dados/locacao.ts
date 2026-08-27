import 'server-only'
import { criarClienteServidor } from '@/lib/supabase/server'
import {
  apurarContrato,
  statusDoContrato,
  type ApuracaoContrato,
  type ItemContrato,
  type StatusContrato,
  type StatusEquipamento,
  type TabelaPreco,
} from '@/lib/domain/locacao'
import { hojeISO, type Centavos, type DataISO } from '@/lib/format'

export interface EquipamentoRow {
  id: string
  descricao: string
  categoria: string | null
  patrimonio: string | null
  quantidade_estoque: number
  valor_compra: Centavos | null
  status: StatusEquipamento
  tabela: TabelaPreco | null
}

export async function listarEquipamentos(): Promise<EquipamentoRow[]> {
  const supabase = await criarClienteServidor()

  const { data } = await supabase
    .from('equipamentos')
    .select(
      'id, descricao, categoria, patrimonio, quantidade_estoque, valor_compra, status, tabela:tabela_locacao (valor_diaria, valor_semana, valor_mes)',
    )
    .is('excluido_em', null)
    .order('categoria')
    .order('descricao')

  return (data ?? []).map((e) => {
    const t = Array.isArray(e.tabela) ? e.tabela[0] : e.tabela
    return {
      id: e.id as string,
      descricao: e.descricao as string,
      categoria: (e.categoria as string) ?? null,
      patrimonio: (e.patrimonio as string) ?? null,
      quantidade_estoque: Number(e.quantidade_estoque ?? 1),
      valor_compra: e.valor_compra === null ? null : Number(e.valor_compra),
      status: (e.status as StatusEquipamento) ?? 'disponivel',
      tabela: t
        ? {
            valor_diaria: Number((t as TabelaPreco).valor_diaria ?? 0),
            valor_semana: Number((t as TabelaPreco).valor_semana ?? 0),
            valor_mes: Number((t as TabelaPreco).valor_mes ?? 0),
          }
        : null,
    }
  })
}

export interface ContratoRow {
  id: string
  cliente_id: string | null
  cliente_nome: string | null
  obra_id: string | null
  obra_nome: string | null
  uso_interno: boolean
  data_saida: DataISO
  data_prevista: DataISO | null
  data_devolucao: DataISO | null
  valor: Centavos
  caucao: Centavos
  forma_pagamento: string | null
  observacao: string | null
  status: StatusContrato
  itens: ItemContrato[]
  apuracao: ApuracaoContrato
  status_atual: StatusContrato
}

const CAMPOS =
  'id, cliente_id, obra_id, uso_interno, data_saida, data_prevista, data_devolucao, valor, caucao, forma_pagamento, observacao, status, cliente:clientes (nome), obra:obras (nome)'

export async function listarContratos(): Promise<ContratoRow[]> {
  const supabase = await criarClienteServidor()

  const { data } = await supabase
    .from('contratos_locacao')
    .select(CAMPOS)
    .is('excluido_em', null)
    .order('data_saida', { ascending: false })

  const contratos = data ?? []
  if (contratos.length === 0) return []

  const { data: itensData } = await supabase
    .from('itens_contrato_locacao')
    .select(
      'id, contrato_id, equipamento_id, quantidade, valor, equipamento:equipamentos (descricao, tabela:tabela_locacao (valor_diaria, valor_semana, valor_mes))',
    )
    .in(
      'contrato_id',
      contratos.map((c) => c.id as string),
    )
    .is('excluido_em', null)

  const hoje = hojeISO()

  return contratos.map((c) => montar(c as Record<string, unknown>, itensData ?? [], hoje))
}

export async function carregarContrato(contratoId: string): Promise<ContratoRow | null> {
  const supabase = await criarClienteServidor()

  const { data } = await supabase
    .from('contratos_locacao')
    .select(CAMPOS)
    .eq('id', contratoId)
    .is('excluido_em', null)
    .maybeSingle()

  if (!data) return null

  const { data: itensData } = await supabase
    .from('itens_contrato_locacao')
    .select(
      'id, contrato_id, equipamento_id, quantidade, valor, equipamento:equipamentos (descricao, tabela:tabela_locacao (valor_diaria, valor_semana, valor_mes))',
    )
    .eq('contrato_id', contratoId)
    .is('excluido_em', null)

  return montar(data as Record<string, unknown>, itensData ?? [], hojeISO())
}

function montar(
  row: Record<string, unknown>,
  todosItens: Record<string, unknown>[],
  hoje: DataISO,
): ContratoRow {
  const cliente = Array.isArray(row.cliente) ? row.cliente[0] : row.cliente
  const obra = Array.isArray(row.obra) ? row.obra[0] : row.obra

  const itens: ItemContrato[] = todosItens
    .filter((i) => i.contrato_id === row.id)
    .map((i) => {
      const equipamento = Array.isArray(i.equipamento) ? i.equipamento[0] : i.equipamento
      const t = (equipamento as { tabela?: TabelaPreco | TabelaPreco[] } | null)?.tabela
      const tabela = Array.isArray(t) ? t[0] : t

      return {
        id: i.id as string,
        equipamento_id: i.equipamento_id as string,
        descricao: (equipamento as { descricao?: string } | null)?.descricao ?? '—',
        quantidade: Number(i.quantidade ?? 1),
        tabela: {
          valor_diaria: Number(tabela?.valor_diaria ?? 0),
          valor_semana: Number(tabela?.valor_semana ?? 0),
          valor_mes: Number(tabela?.valor_mes ?? 0),
        },
      }
    })

  const contrato = {
    id: row.id as string,
    cliente_id: (row.cliente_id as string) ?? null,
    cliente_nome: (cliente as { nome?: string } | null)?.nome ?? null,
    obra_id: (row.obra_id as string) ?? null,
    obra_nome: (obra as { nome?: string } | null)?.nome ?? null,
    uso_interno: Boolean(row.uso_interno),
    data_saida: row.data_saida as DataISO,
    data_prevista: (row.data_prevista as DataISO) ?? null,
    data_devolucao: (row.data_devolucao as DataISO) ?? null,
    valor: Number(row.valor ?? 0),
    caucao: Number(row.caucao ?? 0),
    forma_pagamento: (row.forma_pagamento as string) ?? null,
    observacao: (row.observacao as string) ?? null,
    status: (row.status as StatusContrato) ?? 'aberto',
    itens,
  }

  return {
    ...contrato,
    apuracao: apurarContrato({
      itens,
      data_saida: contrato.data_saida,
      data_prevista: contrato.data_prevista,
      data_devolucao: contrato.data_devolucao,
      hoje,
    }),
    status_atual: statusDoContrato(contrato, hoje),
  }
}
