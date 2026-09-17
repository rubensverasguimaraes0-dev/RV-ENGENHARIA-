import 'server-only'
import { criarClienteServidor } from '@/lib/supabase/server'
import { conferirObra, type Achado, type SemanaParaConferir } from '@/lib/domain/conferencia'
import type { ObraCompleta, PainelObra } from '@/lib/dados/obra'
import { listarParcelas } from '@/lib/dados/pagamentos'
import { hojeISO, type DataISO } from '@/lib/format'

/**
 * Levanta a conferencia da obra a partir do banco.
 *
 * A tabela de pagamentos da equipe pode ainda nao existir (migracao pendente).
 * Nesse caso a consulta falha e a conferencia e avisada disso, em vez de
 * concluir que nada foi pago — que seria um alarme falso.
 */
export async function carregarConferencia(
  obra: ObraCompleta,
  painel: PainelObra,
): Promise<Achado[]> {
  const supabase = await criarClienteServidor()
  const obraId = obra.id

  const [parcelas, semanasResp, lancamentosResp, pagamentosResp] = await Promise.all([
    listarParcelas(obraId),
    supabase
      .from('semanas')
      .select('id, numero, data_inicio, data_fim, status')
      .eq('obra_id', obraId)
      .is('excluido_em', null)
      .order('data_inicio', { ascending: true }),
    supabase
      .from('lancamentos_diarios')
      .select('data')
      .eq('obra_id', obraId)
      .is('excluido_em', null),
    supabase
      .from('pagamentos_funcionario')
      .select('semana_id')
      .eq('obra_id', obraId)
      .is('excluido_em', null),
  ])

  const datas = (lancamentosResp.data ?? []).map((l) => l.data as DataISO)
  const datasDistintas = [...new Set(datas)].sort()
  const ultimo_dia_lancado = datasDistintas[datasDistintas.length - 1] ?? null

  const disponivel = !pagamentosResp.error
  const comPagamento = new Set((pagamentosResp.data ?? []).map((p) => p.semana_id as string))

  const semanas: SemanaParaConferir[] = (semanasResp.data ?? []).map((s) => {
    const inicio = s.data_inicio as DataISO
    const fim = s.data_fim as DataISO
    return {
      id: s.id as string,
      numero: Number(s.numero),
      data_inicio: inicio,
      data_fim: fim,
      fechada: s.status === 'fechada',
      dias_lancados: datasDistintas.filter((d) => d >= inicio && d <= fim).length,
      tem_pagamento: comPagamento.has(s.id as string),
    }
  })

  return conferirObra({
    hoje: hojeISO(),
    parcelas: parcelas.map((p) => ({
      numero_parcela: p.numero_parcela,
      valor_previsto: p.valor_previsto,
      data_prevista: p.data_prevista,
      data_recebimento: p.data_recebimento,
      paga: p.status === 'paga',
      tem_comprovante: Boolean(p.comprovante_assinado),
    })),
    semanas,
    custos: {
      materiais: painel.custo_materiais,
      despesas_sem_nota: painel.custo_despesas_sem_nota,
      locacoes: painel.custo_locacoes,
      entulho: painel.custo_entulho,
      terceiros: painel.custo_terceiros,
    },
    ultimo_dia_lancado,
    pagamentos_equipe_disponivel: disponivel,
  })
}
