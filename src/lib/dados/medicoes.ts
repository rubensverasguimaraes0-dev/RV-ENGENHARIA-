import 'server-only'
import { criarClienteServidor } from '@/lib/supabase/server'
import {
  apurarServicos,
  apurarTerceiros,
  totalizarMedicoes,
  totalizarTerceiros,
  type Medicao,
  type ServicoApurado,
  type ServicoMedicao,
  type ServicoTerceiro,
  type TerceiroApurado,
} from '@/lib/domain/medicoes'
import type { Centavos } from '@/lib/format'

export interface MedicaoComServico extends Medicao {
  servico_descricao: string
  servico_unidade: string
  valor: Centavos
}

export interface TerceiroComNome extends TerceiroApurado {
  terceiro_nome: string
  terceiro_atividade: string | null
}

export async function carregarMedicoes(obraId: string): Promise<{
  servicos: ServicoApurado[]
  medicoes: MedicaoComServico[]
  totais: ReturnType<typeof totalizarMedicoes>
}> {
  const supabase = await criarClienteServidor()

  const [{ data: servicosData }, { data: medicoesData }] = await Promise.all([
    supabase
      .from('servicos_medicao')
      .select('id, obra_id, descricao, unidade, quantidade_contratada, custo_unitario, preco_venda_unitario')
      .eq('obra_id', obraId)
      .is('excluido_em', null)
      .order('descricao'),
    supabase
      .from('medicoes')
      .select('id, obra_id, servico_id, local_id, data, quantidade, observacao')
      .eq('obra_id', obraId)
      .is('excluido_em', null)
      .order('data', { ascending: false }),
  ])

  const servicosBrutos = (servicosData ?? []).map((s) => ({
    ...s,
    quantidade_contratada: s.quantidade_contratada === null ? null : Number(s.quantidade_contratada),
    custo_unitario: s.custo_unitario === null ? null : Number(s.custo_unitario),
    preco_venda_unitario: Number(s.preco_venda_unitario ?? 0),
  })) as ServicoMedicao[]

  const medicoesBrutas = (medicoesData ?? []).map((m) => ({
    ...m,
    quantidade: Number(m.quantidade ?? 0),
  })) as Medicao[]

  const servicos = apurarServicos(servicosBrutos, medicoesBrutas)
  const porId = new Map(servicos.map((s) => [s.id, s]))

  const medicoes = medicoesBrutas.map((m) => {
    const s = porId.get(m.servico_id)
    return {
      ...m,
      servico_descricao: s?.descricao ?? '(serviço removido)',
      servico_unidade: String(s?.unidade ?? ''),
      valor: Math.round(m.quantidade * (s?.preco_venda_unitario ?? 0)),
    }
  })

  return { servicos, medicoes, totais: totalizarMedicoes(servicos) }
}

export async function carregarTerceiros(obraId: string): Promise<{
  servicos: TerceiroComNome[]
  totais: ReturnType<typeof totalizarTerceiros>
}> {
  const supabase = await criarClienteServidor()

  const { data } = await supabase
    .from('servicos_terceiros')
    .select(
      'id, obra_id, terceiro_id, descricao, quantidade, valor_combinado, valor_pago, comprovante_url, terceiro:terceiros (nome, atividade)',
    )
    .eq('obra_id', obraId)
    .is('excluido_em', null)

  const brutos = (data ?? []).map((s) => ({
    ...s,
    quantidade: s.quantidade === null ? null : Number(s.quantidade),
    valor_combinado: Number(s.valor_combinado ?? 0),
    valor_pago: Number(s.valor_pago ?? 0),
  })) as unknown as (ServicoTerceiro & { terceiro: { nome: string; atividade: string | null } | null })[]

  const apurados = apurarTerceiros(brutos)
  const servicos = apurados.map((a, i) => {
    const bruto = brutos[i]
    const t = Array.isArray(bruto?.terceiro) ? bruto.terceiro[0] : bruto?.terceiro
    return {
      ...a,
      terceiro_nome: t?.nome ?? '—',
      terceiro_atividade: t?.atividade ?? null,
    }
  })

  return { servicos, totais: totalizarTerceiros(apurados) }
}
