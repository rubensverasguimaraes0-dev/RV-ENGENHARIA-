'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/supabase/sessao'
import {
  dataOuNulo,
  moedaOuNulo,
  moedaOuZero,
  numeroOuNulo,
  textoObrigatorio,
  textoOuNulo,
  type EstadoForm,
} from '@/lib/form'
import { hojeISO } from '@/lib/format'

export async function salvarServico(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const obra_id = textoObrigatorio(form.get('obra_id'))
  const id = textoObrigatorio(form.get('id'))
  const descricao = textoObrigatorio(form.get('descricao'))
  if (!descricao) return { erro: 'Descreva o serviço.' }

  const preco = moedaOuZero(form.get('preco_venda_unitario'))
  if (preco <= 0) return { erro: 'Informe o preço de venda unitário.' }

  const registro = {
    obra_id,
    descricao,
    unidade: textoObrigatorio(form.get('unidade')) || 'm2',
    quantidade_contratada: numeroOuNulo(form.get('quantidade_contratada')),
    // custo unitario (material + mao de obra) e interno
    custo_unitario: moedaOuNulo(form.get('custo_unitario')),
    preco_venda_unitario: preco,
  }

  const { error } = id
    ? await supabase.from('servicos_medicao').update(registro).eq('id', id)
    : await supabase.from('servicos_medicao').insert(registro)

  if (error) return { erro: error.message }

  revalidatePath(`/obras/${obra_id}/medicoes`)
  return { ok: id ? 'Serviço atualizado.' : 'Serviço cadastrado.' }
}

/** Lancamento da medicao executada, por data e local. */
export async function lancarMedicao(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const obra_id = textoObrigatorio(form.get('obra_id'))
  const servico_id = textoObrigatorio(form.get('servico_id'))
  const quantidade = numeroOuNulo(form.get('quantidade'))

  if (!servico_id) return { erro: 'Selecione o serviço.' }
  if (quantidade === null || quantidade <= 0) return { erro: 'Informe a quantidade executada.' }

  const { error } = await supabase.from('medicoes').insert({
    obra_id,
    servico_id,
    local_id: textoOuNulo(form.get('local_id')),
    data: dataOuNulo(form.get('data')) ?? hojeISO(),
    quantidade,
    observacao: textoOuNulo(form.get('observacao')),
  })

  if (error) return { erro: error.message }

  revalidatePath(`/obras/${obra_id}/medicoes`)
  revalidatePath(`/obras/${obra_id}`)
  return { ok: 'Medição lançada.' }
}

export async function salvarServicoTerceiro(
  _e: EstadoForm | null,
  form: FormData,
): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const obra_id = textoObrigatorio(form.get('obra_id'))
  const id = textoObrigatorio(form.get('id'))
  const terceiro_id = textoObrigatorio(form.get('terceiro_id'))
  if (!terceiro_id) return { erro: 'Selecione o terceiro.' }

  const comprovante = textoOuNulo(form.get('comprovante'))
  const registro = {
    obra_id,
    terceiro_id,
    descricao: textoOuNulo(form.get('descricao')),
    quantidade: numeroOuNulo(form.get('quantidade')),
    valor_combinado: moedaOuZero(form.get('valor_combinado')),
    valor_pago: moedaOuZero(form.get('valor_pago')),
    ...(comprovante ? { comprovante_url: comprovante } : {}),
  }

  const { error } = id
    ? await supabase.from('servicos_terceiros').update(registro).eq('id', id)
    : await supabase.from('servicos_terceiros').insert(registro)

  if (error) return { erro: error.message }

  revalidatePath(`/obras/${obra_id}/medicoes`)
  revalidatePath(`/obras/${obra_id}`)
  return { ok: 'Serviço de terceiro salvo.' }
}

export async function arquivarServico(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const obraId = textoObrigatorio(form.get('obra_id'))
  await supabase
    .from('servicos_medicao')
    .update({ excluido_em: new Date().toISOString() })
    .eq('id', textoObrigatorio(form.get('id')))
  revalidatePath(`/obras/${obraId}/medicoes`)
}

export async function estornarMedicao(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const obraId = textoObrigatorio(form.get('obra_id'))
  await supabase
    .from('medicoes')
    .update({ excluido_em: new Date().toISOString() })
    .eq('id', textoObrigatorio(form.get('id')))
  revalidatePath(`/obras/${obraId}/medicoes`)
}
