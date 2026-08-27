'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/supabase/sessao'
import {
  booleano,
  dataOuNulo,
  moedaOuNulo,
  moedaOuZero,
  textoObrigatorio,
  textoOuNulo,
  type EstadoForm,
} from '@/lib/form'
import { calcularParcelaBalao, statusDaParcela } from '@/lib/domain/pagamentos'
import { hojeISO } from '@/lib/format'

export async function salvarParcela(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const obra_id = textoObrigatorio(form.get('obra_id'))
  const id = textoObrigatorio(form.get('id'))
  const numero = Number(form.get('numero_parcela') ?? 0)
  if (!obra_id || !Number.isFinite(numero) || numero <= 0) {
    return { erro: 'Informe o número da parcela.' }
  }

  const balao = booleano(form.get('balao'))
  const registro = {
    obra_id,
    numero_parcela: numero,
    valor_previsto: moedaOuZero(form.get('valor_previsto')),
    data_prevista: dataOuNulo(form.get('data_prevista')),
    balao,
    observacao: textoOuNulo(form.get('observacao')),
  }

  const { error } = id
    ? await supabase.from('pagamentos').update(registro).eq('id', id)
    : await supabase.from('pagamentos').insert(registro)

  if (error) return { erro: error.message }

  await recalcularBalao(obra_id)
  revalidatePath(`/obras/${obra_id}/pagamentos`)
  return { ok: 'Parcela salva.' }
}

/**
 * Registra o recebimento. Um mesmo comprovante pode conter valor de outro
 * contrato: o que entra nesta obra e o recebido menos essa parte, e a
 * observacao sai explicita no relatorio (spec 4.9).
 */
export async function registrarRecebimento(
  _e: EstadoForm | null,
  form: FormData,
): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const obra_id = textoObrigatorio(form.get('obra_id'))
  const id = textoObrigatorio(form.get('id'))
  if (!id) return { erro: 'Parcela não informada.' }

  const valor_recebido = moedaOuNulo(form.get('valor_recebido'))
  if (valor_recebido === null || valor_recebido <= 0) return { erro: 'Informe o valor recebido.' }

  const valor_outro_contrato = moedaOuZero(form.get('valor_outro_contrato'))
  if (valor_outro_contrato > valor_recebido) {
    return { erro: 'A parte de outro contrato não pode ser maior que o valor recebido.' }
  }

  const data_recebimento = dataOuNulo(form.get('data_recebimento')) ?? hojeISO()
  const comprovante = textoOuNulo(form.get('comprovante'))

  const registro = {
    valor_recebido,
    data_recebimento,
    forma_pagamento: textoOuNulo(form.get('forma_pagamento')),
    valor_outro_contrato,
    observacao: textoOuNulo(form.get('observacao')),
    status: 'paga' as const,
    ...(comprovante ? { comprovante_url: comprovante } : {}),
  }

  const { error } = await supabase.from('pagamentos').update(registro).eq('id', id)
  if (error) return { erro: error.message }

  await recalcularBalao(obra_id)
  revalidatePath(`/obras/${obra_id}/pagamentos`)
  revalidatePath(`/obras/${obra_id}`)
  return { ok: 'Recebimento registrado.' }
}

export async function arquivarParcela(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const obraId = textoObrigatorio(form.get('obra_id'))
  await supabase
    .from('pagamentos')
    .update({ excluido_em: new Date().toISOString() })
    .eq('id', textoObrigatorio(form.get('id')))
  await recalcularBalao(obraId)
  revalidatePath(`/obras/${obraId}/pagamentos`)
}

/**
 * A parcela balao e sempre o saldo remanescente do contrato: recalcula sozinha
 * quando qualquer outra parcela muda.
 */
async function recalcularBalao(obraId: string) {
  const supabase = await criarClienteServidor()

  const [{ data: obra }, { data: parcelas }] = await Promise.all([
    supabase.from('obras').select('valor_contrato').eq('id', obraId).maybeSingle(),
    supabase
      .from('pagamentos')
      .select('id, valor_previsto, balao, valor_recebido, data_prevista, data_recebimento')
      .eq('obra_id', obraId)
      .is('excluido_em', null),
  ])

  const lista = (parcelas ?? []).map((p) => ({
    ...p,
    valor_previsto: Number(p.valor_previsto ?? 0),
  }))

  const balao = lista.find((p) => p.balao)
  if (balao && obra) {
    const valor = calcularParcelaBalao(lista, Number(obra.valor_contrato ?? 0), balao.id as string)
    await supabase.from('pagamentos').update({ valor_previsto: valor }).eq('id', balao.id)
  }

  // status derivado: prevista, paga ou atrasada
  const hoje = hojeISO()
  for (const p of lista) {
    const novo = statusDaParcela(
      {
        valor_recebido: p.valor_recebido === null ? null : Number(p.valor_recebido),
        data_prevista: p.data_prevista as string | null,
        data_recebimento: p.data_recebimento as string | null,
      },
      hoje,
    )
    await supabase.from('pagamentos').update({ status: novo }).eq('id', p.id)
  }
}
