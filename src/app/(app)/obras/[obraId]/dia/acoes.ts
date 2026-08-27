'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { exigirUsuario } from '@/lib/supabase/sessao'
import { moedaOuZero, textoObrigatorio, type EstadoForm } from '@/lib/form'
import type { TipoDiaria } from '@/lib/domain/tipos'

/**
 * Marca a presenca do dia. O valor da diaria e resolvido no servidor pela
 * funcao registrar_presenca — o lancador nem conhece o valor, e o admin pode
 * sobrescrever quando o funcionario chegou fora do horario.
 */
export async function marcarPresenca(entrada: {
  obraId: string
  funcionarioId: string
  data: string
  tipo: TipoDiaria
  valorDiaria?: number | null
  vale?: number
  observacao?: string | null
}): Promise<EstadoForm> {
  const usuario = await exigirUsuario()
  const supabase = await criarClienteServidor()

  const { error } = await supabase.rpc('registrar_presenca', {
    p_obra_id: entrada.obraId,
    p_funcionario_id: entrada.funcionarioId,
    p_data: entrada.data,
    p_tipo_diaria: entrada.tipo,
    p_valor_vale: entrada.vale ?? 0,
    p_observacao: entrada.observacao ?? null,
    p_valor_diaria: usuario.perfil === 'admin' ? entrada.valorDiaria ?? null : null,
  })

  if (error) return { erro: traduzir(error.message) }

  revalidatePath(`/obras/${entrada.obraId}/dia`)
  return { ok: 'Lançado.' }
}

export async function removerPresenca(entrada: {
  obraId: string
  funcionarioId: string
  data: string
}): Promise<EstadoForm> {
  await exigirUsuario()
  const supabase = await criarClienteServidor()

  const { error } = await supabase.rpc('remover_presenca', {
    p_obra_id: entrada.obraId,
    p_funcionario_id: entrada.funcionarioId,
    p_data: entrada.data,
  })

  if (error) return { erro: traduzir(error.message) }

  revalidatePath(`/obras/${entrada.obraId}/dia`)
  return { ok: 'Removido.' }
}

/** Quentinhas do dia: quantidade e valor unitario, que muda com o fornecedor. */
export async function salvarQuentinha(entrada: {
  obraId: string
  data: string
  quantidade: number
  valorUnitario: number
}): Promise<EstadoForm> {
  await exigirUsuario()
  const supabase = await criarClienteServidor()

  const { error } = await supabase.rpc('registrar_quentinha', {
    p_obra_id: entrada.obraId,
    p_data: entrada.data,
    p_quantidade: entrada.quantidade,
    p_valor_unitario: entrada.valorUnitario,
  })

  if (error) return { erro: traduzir(error.message) }

  revalidatePath(`/obras/${entrada.obraId}/dia`)
  return { ok: 'Quentinhas registradas.' }
}

export async function salvarQuentinhaForm(
  _e: EstadoForm | null,
  form: FormData,
): Promise<EstadoForm> {
  const quantidade = Number(form.get('quantidade') ?? 0)
  if (!Number.isFinite(quantidade) || quantidade < 0) return { erro: 'Quantidade inválida.' }

  return salvarQuentinha({
    obraId: textoObrigatorio(form.get('obra_id')),
    data: textoObrigatorio(form.get('data')),
    quantidade,
    valorUnitario: moedaOuZero(form.get('valor_unitario')),
  })
}

function traduzir(mensagem: string): string {
  if (mensagem.includes('semana ja fechada'))
    return 'Esta semana já foi fechada. Reabra a semana para alterar os lançamentos.'
  if (mensagem.includes('sem acesso a esta obra'))
    return 'Você não tem acesso a esta obra.'
  if (mensagem.includes('funcionario nao encontrado')) return 'Funcionário não encontrado.'
  return mensagem
}
