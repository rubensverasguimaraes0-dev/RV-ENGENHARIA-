import { criarClienteServidor } from '@/lib/supabase/server'
import { evolucaoDaObra, resumirEquipe, resumoMensal } from '@/lib/domain/painel-obra'
import type { LinhaDaEquipe, MesDaObra, PontoDaEvolucao } from '@/lib/domain/painel-obra'
import { hojeISO, type DataISO } from '@/lib/format'
import type { Funcionario, LancamentoDiario, Pagamento, Quentinha, Semana } from '@/lib/domain/tipos'

export interface DetalheDaObra {
  equipe: LinhaDaEquipe[]
  evolucao: PontoDaEvolucao[]
  meses: MesDaObra[]
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

  const [lancamentos, funcionarios, quentinhas, semanas, pagamentos, notas, despesas] = await Promise.all([
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
    // Material do mes: so o que a RV pagou. Nota paga pelo cliente passa pela
    // obra mas nao sai do caixa da RV — soma-la faria o mes parecer pior.
    supabase
      .from('notas_fiscais')
      .select('data, valor')
      .eq('obra_id', obraId)
      .eq('pago_por', 'rv')
      .is('excluido_em', null),
    supabase
      .from('despesas_sem_nota')
      .select('data, valor')
      .eq('obra_id', obraId)
      .is('excluido_em', null),
  ])

  const semanasLidas = (semanas.data ?? []).map((s) => ({
    ...s,
    dias_sem_expediente: Array.isArray(s.dias_sem_expediente_json)
      ? (s.dias_sem_expediente_json as string[])
      : [],
  })) as unknown as Semana[]

  const lidos = {
    lancamentos: (lancamentos.data ?? []) as unknown as LancamentoDiario[],
    quentinhas: (quentinhas.data ?? []) as unknown as Quentinha[],
    pagamentos: (pagamentos.data ?? []) as unknown as Pagamento[],
    materiais: [...(notas.data ?? []), ...(despesas.data ?? [])] as { data: DataISO; valor: number }[],
  }

  return {
    meses: resumoMensal({ ...lidos, hoje: hojeISO() }),
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
