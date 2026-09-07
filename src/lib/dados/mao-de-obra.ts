import 'server-only'
import { criarClienteServidor } from '@/lib/supabase/server'
import {
  montarRelatorioMaoDeObra,
  type RelatorioMaoDeObra,
} from '@/lib/domain/mao-de-obra'
import type { Funcionario, LancamentoDiario, Quentinha } from '@/lib/domain/tipos'

/**
 * Mao de obra da obra inteira, dia a dia — a base do relatorio interno de
 * custo realizado. Diferente do fechamento semanal, que fecha uma semana so,
 * este olha a obra do primeiro ao ultimo dia lancado.
 */
export async function carregarMaoDeObra(
  obraId: string,
  verba: number,
): Promise<RelatorioMaoDeObra> {
  const supabase = await criarClienteServidor()

  const [{ data: lancamentosData }, { data: quentinhasData }, { data: funcionariosData }] =
    await Promise.all([
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

  return montarRelatorioMaoDeObra({ lancamentos, quentinhas, funcionarios, verba })
}
