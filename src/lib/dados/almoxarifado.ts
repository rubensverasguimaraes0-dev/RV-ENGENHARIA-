import 'server-only'
import { criarClienteServidor } from '@/lib/supabase/server'
import {
  resumirAlmoxarifado,
  type ItemAlmoxarifado,
  type ResumoAlmoxarifado,
  type SaidaAlmoxarifado,
} from '@/lib/domain/almoxarifado'

export interface SaidaComItem extends SaidaAlmoxarifado {
  item_descricao: string
  item_categoria: string
  item_unidade: string | null
}

export async function carregarAlmoxarifado(obraId: string): Promise<{
  resumo: ResumoAlmoxarifado
  itens: ItemAlmoxarifado[]
  saidas: SaidaComItem[]
}> {
  const supabase = await criarClienteServidor()

  const { data: itensData } = await supabase
    .from('almoxarifado_itens')
    .select(
      'id, obra_id, categoria, descricao, unidade, quantidade, cor_bitola, metragem, custo_unitario, valor_cobranca',
    )
    .eq('obra_id', obraId)
    .is('excluido_em', null)
    .order('categoria')
    .order('descricao')

  const itens = (itensData ?? []).map((i) => ({
    ...i,
    quantidade: i.quantidade === null ? null : Number(i.quantidade),
    metragem: i.metragem === null ? null : Number(i.metragem),
    custo_unitario: i.custo_unitario === null ? null : Number(i.custo_unitario),
    valor_cobranca: i.valor_cobranca === null ? null : Number(i.valor_cobranca),
  })) as ItemAlmoxarifado[]

  const ids = itens.map((i) => i.id)
  const { data: saidasData } = ids.length
    ? await supabase
        .from('almoxarifado_saidas')
        .select('id, item_id, data, quantidade, quem_pegou, onde_usou, cobrar_cliente')
        .in('item_id', ids)
        .is('excluido_em', null)
        .order('data', { ascending: false })
    : { data: [] }

  const porId = new Map(itens.map((i) => [i.id, i]))
  const saidas = (saidasData ?? []).map((s) => {
    const item = porId.get(s.item_id as string)
    return {
      ...s,
      quantidade: Number(s.quantidade ?? 0),
      item_descricao: item?.descricao ?? '(item removido)',
      item_categoria: item?.categoria ?? '',
      item_unidade: item?.unidade ?? null,
    }
  }) as SaidaComItem[]

  return { resumo: resumirAlmoxarifado(itens, saidas), itens, saidas }
}
