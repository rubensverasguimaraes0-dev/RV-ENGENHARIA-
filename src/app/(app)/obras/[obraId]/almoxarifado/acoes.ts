'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/supabase/sessao'
import {
  booleano,
  dataOuNulo,
  moedaOuNulo,
  numeroOuNulo,
  textoObrigatorio,
  textoOuNulo,
  type EstadoForm,
} from '@/lib/form'
import { hojeISO } from '@/lib/format'

export async function salvarItem(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const obra_id = textoObrigatorio(form.get('obra_id'))
  const id = textoObrigatorio(form.get('id'))
  const descricao = textoObrigatorio(form.get('descricao'))
  if (!descricao) return { erro: 'Descreva o item.' }

  const metragem = numeroOuNulo(form.get('metragem'))
  const quantidade = numeroOuNulo(form.get('quantidade'))

  const registro = {
    obra_id,
    // grafia em caixa alta (spec 4.10)
    categoria: (textoObrigatorio(form.get('categoria')) || 'OUTROS').toUpperCase(),
    descricao: descricao.toUpperCase(),
    unidade: textoOuNulo(form.get('unidade')),
    // cabo por pedaco: a metragem do pedaco e a propria quantidade
    quantidade: quantidade ?? metragem,
    cor_bitola: textoOuNulo(form.get('cor_bitola'))?.toUpperCase() ?? null,
    metragem,
    custo_unitario: moedaOuNulo(form.get('custo_unitario')),
    valor_cobranca: moedaOuNulo(form.get('valor_cobranca')),
  }

  const { error } = id
    ? await supabase.from('almoxarifado_itens').update(registro).eq('id', id)
    : await supabase.from('almoxarifado_itens').insert(registro)

  if (error) return { erro: error.message }

  revalidatePath(`/obras/${obra_id}/almoxarifado`)
  return { ok: id ? 'Item atualizado.' : 'Item cadastrado.' }
}

/** Baixa no estoque: quem pegou, onde usou e se vai ser cobrada do cliente. */
export async function registrarSaida(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const obra_id = textoObrigatorio(form.get('obra_id'))
  const item_id = textoObrigatorio(form.get('item_id'))
  const quantidade = numeroOuNulo(form.get('quantidade'))

  if (!item_id) return { erro: 'Selecione o item.' }
  if (quantidade === null || quantidade <= 0) return { erro: 'Informe a quantidade da saída.' }

  const { error } = await supabase.from('almoxarifado_saidas').insert({
    item_id,
    data: dataOuNulo(form.get('data')) ?? hojeISO(),
    quantidade,
    quem_pegou: textoOuNulo(form.get('quem_pegou')),
    onde_usou: textoOuNulo(form.get('onde_usou')),
    cobrar_cliente: booleano(form.get('cobrar_cliente')),
  })

  if (error) return { erro: error.message }

  revalidatePath(`/obras/${obra_id}/almoxarifado`)
  return { ok: 'Saída registrada.' }
}

export async function arquivarItem(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const obraId = textoObrigatorio(form.get('obra_id'))
  await supabase
    .from('almoxarifado_itens')
    .update({ excluido_em: new Date().toISOString() })
    .eq('id', textoObrigatorio(form.get('id')))
  revalidatePath(`/obras/${obraId}/almoxarifado`)
}

export async function estornarSaida(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const obraId = textoObrigatorio(form.get('obra_id'))
  await supabase
    .from('almoxarifado_saidas')
    .update({ excluido_em: new Date().toISOString() })
    .eq('id', textoObrigatorio(form.get('id')))
  revalidatePath(`/obras/${obraId}/almoxarifado`)
}
