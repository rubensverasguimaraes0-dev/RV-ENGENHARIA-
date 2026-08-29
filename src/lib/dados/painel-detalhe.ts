import { criarClienteServidor } from '@/lib/supabase/server'
import { evolucaoDaObra, resumirEquipe } from '@/lib/domain/painel-obra'
import type { LinhaDaEquipe, PontoDaEvolucao } from '@/lib/domain/painel-obra'
import type { Funcionario, LancamentoDiario, Pagamento, Quentinha, Semana } from '@/lib/domain/tipos'

export interface DetalheDaObra {
  equipe: LinhaDaEquipe[]
  evolucao: PontoDaEvolucao[]
}

/**
 * O detalhe que o painel mostra abaixo dos totais.
 *
 * Cinco consultas em paralelo. Sao as mesmas linhas que ja alimentavam os
 * totais — a diferenca e que aqui elas vem inteiras, em vez de somadas no
 * banco, porque e o detalhe que se quer ver.
 */
export async function carregarDetalheDaObra(obraId: string): Promise<DetalheDaObra> {
  const supabase = await criarClienteServidor()

  const [lancamentos, funcionarios, quentinhas, semanas, pagamentos] = await Promise.all([
    supabase
      .from('lancamentos_diarios')
      .select('id, obra_id, semana_id, funcionario_id, data, tipo_diaria, valor_diaria, valor_vale, observacao')
      .eq('obra_id', obraId)
      .is('excluido_em', null),
    supabase
      .from('funcionarios')
      .select('id, nome, tipo, funcao, valor_diaria, telefone, chave_pix, status, data_entrada, data_saida')
      .is('excluido_em', null),
    supabase
      .from('quentinhas')
      .select('id, obra_id, semana_id, data, quantidade, valor_unitario')
      .eq('obra_id', obraId)
      .is('excluido_em', null),
    supabase
      .from('semanas')
      .select('id, obra_id, numero, data_inicio, data_fim, dias_sem_expediente_json, status')
      .eq('obra_id', obraId)
      .is('excluido_em', null),
    supabase
      .from('pagamentos')
      .select('id, obra_id, numero_parcela, valor_previsto, data_prevista, valor_recebido, data_recebimento, forma_pagamento, comprovante_url, valor_outro_contrato, observacao, status, balao')
      .eq('obra_id', obraId)
      .is('excluido_em', null),
  ])

  const semanasLidas = (semanas.data ?? []).map((s) => ({
    ...s,
    dias_sem_expediente: Array.isArray(s.dias_sem_expediente_json)
      ? (s.dias_sem_expediente_json as string[])
      : [],
  })) as unknown as Semana[]

  return {
    equipe: resumirEquipe(
      (lancamentos.data ?? []) as unknown as LancamentoDiario[],
      (funcionarios.data ?? []) as unknown as Funcionario[],
    ),
    evolucao: evolucaoDaObra({
      semanas: semanasLidas,
      lancamentos: (lancamentos.data ?? []) as unknown as LancamentoDiario[],
      quentinhas: (quentinhas.data ?? []) as unknown as Quentinha[],
      pagamentos: (pagamentos.data ?? []) as unknown as Pagamento[],
    }),
  }
}
