import 'server-only'
import { criarClienteServidor } from '@/lib/supabase/server'
import { calcularFechamentoSemanal, type FechamentoSemanal } from '@/lib/domain/fechamento-semanal'
import type { Funcionario, LancamentoDiario, Quentinha, Semana } from '@/lib/domain/tipos'
import type { DataISO } from '@/lib/format'

export interface SemanaRow extends Semana {
  fechada_em: string | null
}

export async function listarSemanas(obraId: string): Promise<SemanaRow[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('semanas')
    .select('id, obra_id, numero, data_inicio, data_fim, dias_sem_expediente_json, status, fechada_em')
    .eq('obra_id', obraId)
    .is('excluido_em', null)
    .order('data_inicio', { ascending: false })

  return (data ?? []).map(normalizar)
}

function normalizar(row: Record<string, unknown>): SemanaRow {
  return {
    id: row.id as string,
    obra_id: row.obra_id as string,
    numero: Number(row.numero),
    data_inicio: row.data_inicio as DataISO,
    data_fim: row.data_fim as DataISO,
    dias_sem_expediente: Array.isArray(row.dias_sem_expediente_json)
      ? (row.dias_sem_expediente_json as DataISO[])
      : [],
    status: row.status as 'aberta' | 'fechada',
    fechada_em: (row.fechada_em as string) ?? null,
  }
}

/**
 * Monta o fechamento da semana a partir do que esta lancado.
 * A regra de quem aparece e o que soma fica em domain/fechamento-semanal.
 */
export async function carregarFechamento(
  obraId: string,
  semanaId: string,
): Promise<FechamentoSemanal | null> {
  const supabase = await criarClienteServidor()

  const { data: semanaRow } = await supabase
    .from('semanas')
    .select('id, obra_id, numero, data_inicio, data_fim, dias_sem_expediente_json, status, fechada_em')
    .eq('id', semanaId)
    .eq('obra_id', obraId)
    .is('excluido_em', null)
    .maybeSingle()

  if (!semanaRow) return null
  const semana = normalizar(semanaRow)

  const [{ data: lancamentosData }, { data: quentinhasData }, { data: funcionariosData }] =
    await Promise.all([
      supabase
        .from('lancamentos_diarios')
        .select('id, obra_id, semana_id, funcionario_id, data, tipo_diaria, valor_diaria, valor_vale, observacao')
        .eq('obra_id', obraId)
        .gte('data', semana.data_inicio)
        .lte('data', semana.data_fim)
        .is('excluido_em', null),
      supabase
        .from('quentinhas')
        .select('id, obra_id, semana_id, data, quantidade, valor_unitario')
        .eq('obra_id', obraId)
        .gte('data', semana.data_inicio)
        .lte('data', semana.data_fim)
        .is('excluido_em', null),
      supabase
        .from('funcionarios')
        .select('id, nome, tipo, funcao, valor_diaria, telefone, chave_pix, status, data_entrada, data_saida')
        .is('excluido_em', null),
    ])

  const lancamentos = (lancamentosData ?? []).map((l) => ({
    ...l,
    valor_diaria: Number(l.valor_diaria ?? 0),
    valor_vale: Number(l.valor_vale ?? 0),
  })) as LancamentoDiario[]

  const quentinhas = (quentinhasData ?? []).map((q) => ({
    ...q,
    quantidade: Number(q.quantidade ?? 0),
    valor_unitario: Number(q.valor_unitario ?? 0),
  })) as Quentinha[]

  const funcionarios = (funcionariosData ?? []).map((f) => ({
    ...f,
    valor_diaria: Number(f.valor_diaria ?? 0),
  })) as Funcionario[]

  return calcularFechamentoSemanal({ semana, lancamentos, quentinhas, funcionarios })
}
