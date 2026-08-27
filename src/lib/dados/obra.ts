import 'server-only'
import { criarClienteServidor } from '@/lib/supabase/server'
import type { Centavos, DataISO } from '@/lib/format'
import { hojeISO, segundaDaSemana } from '@/lib/format'
import { calcularResultado, type ApuracaoResultado, type BaseRateioParceiro } from '@/lib/domain/resultado'

export interface ObraResumo {
  id: string
  nome: string
  endereco: string | null
  status: string
  data_inicio: DataISO | null
  forma_contratacao: string
  cliente_nome: string
}

/** Obras que o usuario atual pode abrir. A view ja aplica o vinculo do lancador. */
export async function listarObrasVisiveis(): Promise<ObraResumo[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('obras_visiveis')
    .select('id, nome, endereco, status, data_inicio, forma_contratacao, cliente_nome')
    .order('nome')
  return (data ?? []) as ObraResumo[]
}

export interface ObraCompleta {
  id: string
  nome: string
  endereco: string | null
  tipo: string | null
  forma_contratacao: string
  status: string
  data_inicio: DataISO | null
  data_prevista_fim: DataISO | null
  valor_contrato: Centavos
  percentual_rateio_parceiro: number
  base_rateio_parceiro: BaseRateioParceiro
  observacoes: string | null
  cliente_id: string
  cliente_pagador_id: string | null
  cliente: { id: string; nome: string; razao_social_comprovante: string | null; documento: string | null } | null
  pagador: { id: string; nome: string; razao_social_comprovante: string | null; documento: string | null } | null
}

/** Obra com valores — so o admin le a tabela obras (RLS). */
export async function carregarObra(obraId: string): Promise<ObraCompleta | null> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('obras')
    .select(
      `id, nome, endereco, tipo, forma_contratacao, status, data_inicio, data_prevista_fim,
       valor_contrato, percentual_rateio_parceiro, base_rateio_parceiro, observacoes,
       cliente_id, cliente_pagador_id,
       cliente:clientes!obras_cliente_id_fkey (id, nome, razao_social_comprovante, documento),
       pagador:clientes!obras_cliente_pagador_id_fkey (id, nome, razao_social_comprovante, documento)`,
    )
    .eq('id', obraId)
    .is('excluido_em', null)
    .maybeSingle()

  if (!data) return null
  const bruto = data as Record<string, unknown>
  return {
    ...(bruto as unknown as ObraCompleta),
    cliente: primeiro(bruto.cliente),
    pagador: primeiro(bruto.pagador),
  }
}

function primeiro<T>(v: unknown): T | null {
  if (Array.isArray(v)) return (v[0] as T) ?? null
  return (v as T) ?? null
}

export interface PainelObra {
  custo_mao_obra: Centavos
  custo_quentinhas: Centavos
  custo_materiais: Centavos
  custo_despesas_sem_nota: Centavos
  custo_locacoes: Centavos
  custo_entulho: Centavos
  custo_terceiros: Centavos
  receita_medicoes: Centavos
  receita_notas_repassadas: Centavos
  receita_almoxarifado: Centavos
  total_recebido: Centavos
  saldo_contrato: Centavos
  notas_nao_repassadas: number
  valor_notas_nao_repassadas: Centavos
  notas_pendentes: number
  semana_aberta: { id: string; numero: number; data_inicio: DataISO } | null
  apuracao: ApuracaoResultado
}

/**
 * Numeros do painel da obra (spec 4.2) e do resultado (spec 4.15).
 * Tela interna: chamar apenas depois de exigirAdmin().
 */
export async function carregarPainelObra(obra: ObraCompleta): Promise<PainelObra> {
  const supabase = await criarClienteServidor()
  const obraId = obra.id

  const [
    lancamentos,
    quentinhas,
    notas,
    despesas,
    pagamentos,
    medicoes,
    terceiros,
    saidas,
    semanas,
  ] = await Promise.all([
    supabase.from('lancamentos_diarios').select('valor_diaria, tipo_diaria').eq('obra_id', obraId).is('excluido_em', null),
    supabase.from('quentinhas').select('quantidade, valor_unitario').eq('obra_id', obraId).is('excluido_em', null),
    supabase
      .from('notas_fiscais')
      .select('valor, categoria, pago_por, repassada_em')
      .eq('obra_id', obraId)
      .is('excluido_em', null),
    supabase.from('despesas_sem_nota').select('valor, categoria').eq('obra_id', obraId).is('excluido_em', null),
    supabase
      .from('pagamentos')
      .select('valor_recebido, valor_outro_contrato')
      .eq('obra_id', obraId)
      .is('excluido_em', null),
    supabase
      .from('medicoes')
      .select('quantidade, servico:servicos_medicao (preco_venda_unitario, custo_unitario)')
      .eq('obra_id', obraId)
      .is('excluido_em', null),
    supabase.from('servicos_terceiros').select('valor_pago, valor_combinado').eq('obra_id', obraId).is('excluido_em', null),
    supabase
      .from('almoxarifado_saidas')
      .select('quantidade, cobrar_cliente, item:almoxarifado_itens!inner (obra_id, custo_unitario, valor_cobranca)')
      .eq('item.obra_id', obraId)
      .is('excluido_em', null),
    supabase
      .from('semanas')
      .select('id, numero, data_inicio, status')
      .eq('obra_id', obraId)
      .is('excluido_em', null)
      .order('data_inicio', { ascending: false }),
  ])

  const custo_mao_obra = (lancamentos.data ?? []).reduce(
    (s, l) => s + (l.tipo_diaria === 'sem_diaria' ? 0 : Number(l.valor_diaria ?? 0)),
    0,
  )
  const custo_quentinhas = (quentinhas.data ?? []).reduce(
    (s, q) => s + Number(q.quantidade ?? 0) * Number(q.valor_unitario ?? 0),
    0,
  )

  const notasRv = (notas.data ?? []).filter((n) => n.pago_por === 'rv')
  const porCategoria = (cats: string[]) =>
    notasRv.filter((n) => cats.includes(String(n.categoria))).reduce((s, n) => s + Number(n.valor ?? 0), 0)

  const custo_materiais = porCategoria(['material', 'combustivel', 'outro'])
  const custo_locacoes = porCategoria(['locacao'])
  const custo_entulho = porCategoria(['cacamba'])
  const custo_terceiros =
    porCategoria(['terceiro']) +
    (terceiros.data ?? []).reduce((s, t) => s + Number(t.valor_pago ?? 0), 0)
  const custo_despesas_sem_nota = (despesas.data ?? []).reduce((s, d) => s + Number(d.valor ?? 0), 0)

  const naoRepassadas = notasRv.filter((n) => !n.repassada_em)
  const receita_notas_repassadas = notasRv
    .filter((n) => n.repassada_em)
    .reduce((s, n) => s + Number(n.valor ?? 0), 0)

  const receita_medicoes = (medicoes.data ?? []).reduce((s, m) => {
    const servico = Array.isArray(m.servico) ? m.servico[0] : m.servico
    const preco = Number((servico as { preco_venda_unitario?: number } | null)?.preco_venda_unitario ?? 0)
    return s + Math.round(Number(m.quantidade ?? 0) * preco)
  }, 0)

  const receita_almoxarifado = (saidas.data ?? [])
    .filter((s) => s.cobrar_cliente)
    .reduce((acc, s) => {
      const item = Array.isArray(s.item) ? s.item[0] : s.item
      const valor = Number((item as { valor_cobranca?: number } | null)?.valor_cobranca ?? 0)
      return acc + Math.round(Number(s.quantidade ?? 0) * valor)
    }, 0)

  const total_recebido = (pagamentos.data ?? []).reduce(
    (s, p) => s + (Number(p.valor_recebido ?? 0) - Number(p.valor_outro_contrato ?? 0)),
    0,
  )

  const apuracao = calcularResultado({
    receita: {
      contrato: obra.valor_contrato,
      medicoes: receita_medicoes,
      notas_repassadas: receita_notas_repassadas,
      almoxarifado_cobrado: receita_almoxarifado,
    },
    custo: {
      diarias: custo_mao_obra,
      quentinhas: custo_quentinhas,
      materiais: custo_materiais,
      despesas_sem_nota: custo_despesas_sem_nota,
      locacoes: custo_locacoes,
      entulho: custo_entulho,
      terceiros: custo_terceiros,
    },
    percentualRateioParceiro: Number(obra.percentual_rateio_parceiro ?? 0.5),
    baseRateio: obra.base_rateio_parceiro,
  })

  const segunda = segundaDaSemana(hojeISO())
  const lista = (semanas.data ?? []) as { id: string; numero: number; data_inicio: DataISO; status: string }[]
  const semana_aberta =
    lista.find((s) => s.data_inicio === segunda && s.status === 'aberta') ??
    lista.find((s) => s.status === 'aberta') ??
    null

  return {
    custo_mao_obra,
    custo_quentinhas,
    custo_materiais,
    custo_despesas_sem_nota,
    custo_locacoes,
    custo_entulho,
    custo_terceiros,
    receita_medicoes,
    receita_notas_repassadas,
    receita_almoxarifado,
    total_recebido,
    saldo_contrato: obra.valor_contrato - total_recebido,
    notas_nao_repassadas: naoRepassadas.length,
    valor_notas_nao_repassadas: naoRepassadas.reduce((s, n) => s + Number(n.valor ?? 0), 0),
    notas_pendentes: 0,
    semana_aberta: semana_aberta
      ? { id: semana_aberta.id, numero: semana_aberta.numero, data_inicio: semana_aberta.data_inicio }
      : null,
    apuracao,
  }
}
