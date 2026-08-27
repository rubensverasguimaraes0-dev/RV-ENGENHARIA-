import 'server-only'
import { criarClienteServidor } from '@/lib/supabase/server'
import {
  montarFechamento,
  type Adiantamento,
  type Agrupamento,
  type FechamentoDebitos,
  type ServicoExecutado,
} from '@/lib/domain/fechamento-debitos'
import { carregarAlmoxarifado } from './almoxarifado'

/**
 * Monta o fechamento a partir de tudo que ja esta lancado na obra: servicos,
 * adiantamentos recebidos, notas a repassar e material do almoxarifado cobrado.
 */
export async function carregarFechamentoDebitos(
  obraId: string,
  agrupamento: Agrupamento = 'grupo',
): Promise<{ fechamento: FechamentoDebitos; servicos: ServicoExecutado[] }> {
  const supabase = await criarClienteServidor()

  const [{ data: servicosData }, { data: pagamentosData }, { data: notasData }, { data: locaisData }, almox] =
    await Promise.all([
      supabase
        .from('servicos_executados')
        .select(
          'id, obra_id, local_id, grupo, descricao, valor, executado, valor_deducao, justificativa_deducao, ordem, quantidade, unidade',
        )
        .eq('obra_id', obraId)
        .is('excluido_em', null)
        .order('ordem'),
      supabase
        .from('pagamentos')
        .select('id, numero_parcela, data_recebimento, forma_pagamento, valor_recebido, valor_outro_contrato, observacao')
        .eq('obra_id', obraId)
        .is('excluido_em', null)
        .not('valor_recebido', 'is', null)
        .order('numero_parcela'),
      supabase
        .from('notas_fiscais')
        .select('valor')
        .eq('obra_id', obraId)
        .eq('pago_por', 'rv')
        .is('excluido_em', null),
      supabase.from('locais_obra').select('id, nome').eq('obra_id', obraId).is('excluido_em', null),
      carregarAlmoxarifado(obraId),
    ])

  const servicos = (servicosData ?? []).map((s) => ({
    ...s,
    valor: Number(s.valor ?? 0),
    valor_deducao: Number(s.valor_deducao ?? 0),
    ordem: Number(s.ordem ?? 0),
    quantidade: s.quantidade === null ? null : Number(s.quantidade),
  })) as ServicoExecutado[]

  const adiantamentos = (pagamentosData ?? []).map((p) => ({
    ...p,
    valor_recebido: Number(p.valor_recebido ?? 0),
    valor_outro_contrato: Number(p.valor_outro_contrato ?? 0),
  })) as Adiantamento[]

  const notas_a_repassar = (notasData ?? []).reduce((s, n) => s + Number(n.valor ?? 0), 0)

  const nomeLocal = new Map(
    ((locaisData ?? []) as { id: string; nome: string }[]).map((l) => [l.id, l.nome]),
  )

  return {
    servicos,
    fechamento: montarFechamento({
      servicos,
      adiantamentos,
      notas_a_repassar,
      almoxarifado_cobrado: almox.resumo.total_cobrado,
      agrupamento,
      nomeLocal,
    }),
  }
}
