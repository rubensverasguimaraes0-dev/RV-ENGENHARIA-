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

export interface LinhaAcumulado {
  numero: number
  data_inicio: DataISO
  data_fim: DataISO
  diarias: number
  mao_obra: number
  qtd_quentinhas: number
  alimentacao: number
  total: number
}

/**
 * Uma linha por semana da obra, da primeira ate a ultima — o bloco "ACUMULADO
 * DA OBRA" que o padrao exige em todo relatorio semanal.
 *
 * Busca tudo de uma vez e fatia por semana em memoria: sao poucas centenas de
 * lancamentos numa obra inteira, e uma consulta por semana multiplicaria as
 * idas ao banco sem ganho nenhum.
 */
export async function carregarAcumuladoDaObra(obraId: string): Promise<LinhaAcumulado[]> {
  const supabase = await criarClienteServidor()

  const [{ data: semanasData }, { data: lancamentosData }, { data: quentinhasData }, { data: funcionariosData }] =
    await Promise.all([
      supabase
        .from('semanas')
        .select('id, obra_id, numero, data_inicio, data_fim, dias_sem_expediente_json, status, fechada_em')
        .eq('obra_id', obraId)
        .is('excluido_em', null)
        .order('data_inicio', { ascending: true }),
      supabase
        .from('lancamentos_diarios')
        .select('id, obra_id, semana_id, funcionario_id, data, tipo_diaria, valor_diaria, valor_vale, observacao')
        .eq('obra_id', obraId)
        .is('excluido_em', null),
      supabase
        .from('quentinhas')
        .select('id, obra_id, semana_id, data, quantidade, valor_unitario')
        .eq('obra_id', obraId)
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

  return (semanasData ?? []).map(normalizar).map((semana) => {
    const f = calcularFechamentoSemanal({
      semana,
      lancamentos: lancamentos.filter((l) => l.data >= semana.data_inicio && l.data <= semana.data_fim),
      quentinhas: quentinhas.filter((q) => q.data >= semana.data_inicio && q.data <= semana.data_fim),
      funcionarios,
    })
    return {
      numero: semana.numero,
      data_inicio: semana.data_inicio,
      data_fim: semana.data_fim,
      diarias: f.diarias,
      mao_obra: f.total_mao_obra,
      qtd_quentinhas: f.qtd_quentinhas,
      alimentacao: f.total_quentinhas,
      total: f.custo_semana,
    }
  })
}
