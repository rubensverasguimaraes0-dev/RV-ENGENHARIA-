'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
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
import { calcularOrcamento } from '@/lib/domain/orcamento'
import type { ItemOrcamento } from '@/lib/domain/orcamento'

export async function criarOrcamento(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const obra_id = textoObrigatorio(form.get('obra_id'))
  const titulo = textoObrigatorio(form.get('titulo'))
  if (!titulo) return { erro: 'Dê um título ao orçamento.' }

  const { data: obra } = await supabase
    .from('obras')
    .select('cliente_id')
    .eq('id', obra_id)
    .maybeSingle()

  const pct = (campo: string, padrao: number) => {
    const n = numeroOuNulo(form.get(campo))
    return n === null ? padrao : n / 100
  }

  const { data, error } = await supabase
    .from('orcamentos')
    .insert({
      obra_id,
      cliente_id: obra?.cliente_id ?? null,
      titulo,
      numero: textoOuNulo(form.get('numero')),
      tipo: textoObrigatorio(form.get('tipo')) || 'rapido',
      margem: pct('margem', 0.3),
      bdi: pct('bdi', 0),
      modo_bdi: textoObrigatorio(form.get('modo_bdi')) || 'embutido',
      validade: dataOuNulo(form.get('validade')),
    })
    .select('id')
    .single()

  if (error) return { erro: error.message }

  revalidatePath(`/obras/${obra_id}/orcamentos`)
  redirect(`/obras/${obra_id}/orcamentos/${data.id}`)
}

export async function salvarCabecalho(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const id = textoObrigatorio(form.get('id'))
  const obra_id = textoObrigatorio(form.get('obra_id'))

  const pct = (campo: string, padrao: number) => {
    const n = numeroOuNulo(form.get(campo))
    return n === null ? padrao : n / 100
  }

  const { error } = await supabase
    .from('orcamentos')
    .update({
      titulo: textoObrigatorio(form.get('titulo')),
      numero: textoOuNulo(form.get('numero')),
      tipo: textoObrigatorio(form.get('tipo')) || 'rapido',
      margem: pct('margem', 0.3),
      bdi: pct('bdi', 0),
      modo_bdi: textoObrigatorio(form.get('modo_bdi')) || 'embutido',
      validade: dataOuNulo(form.get('validade')),
      memorial: textoOuNulo(form.get('memorial')),
      condicoes_json: {
        prazo: String(form.get('condicao_prazo') ?? ''),
        forma_pagamento: String(form.get('condicao_pagamento') ?? ''),
        garantia: String(form.get('condicao_garantia') ?? ''),
        nao_incluso: String(form.get('condicao_nao_incluso') ?? ''),
      },
    })
    .eq('id', id)

  if (error) return { erro: error.message }

  await recalcularTotal(id)
  revalidatePath(`/obras/${obra_id}/orcamentos/${id}`)
  return { ok: 'Orçamento atualizado.' }
}

export async function salvarItem(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const orcamento_id = textoObrigatorio(form.get('orcamento_id'))
  const obra_id = textoObrigatorio(form.get('obra_id'))
  const id = textoObrigatorio(form.get('id'))
  const descricao = textoObrigatorio(form.get('descricao'))
  if (!descricao) return { erro: 'Descreva o item.' }

  const fase = textoOuNulo(form.get('fase'))
  if (fase && !/^\d+(\.\d+)*$/.test(fase)) {
    return { erro: 'A fase deve ser numérica, no formato 1, 1.1 ou 1.1.1.' }
  }

  const registro = {
    orcamento_id,
    fase,
    codigo_referencia: textoOuNulo(form.get('codigo_referencia')),
    base_referencia: textoObrigatorio(form.get('base_referencia')) || 'proprio',
    descricao,
    unidade: textoOuNulo(form.get('unidade')),
    quantidade: numeroOuNulo(form.get('quantidade')),
    custo_material: moedaOuNulo(form.get('custo_material')),
    custo_mao_obra: moedaOuNulo(form.get('custo_mao_obra')),
    preco_unitario: moedaOuNulo(form.get('preco_unitario')),
    terceirizado_sem_valor: booleano(form.get('terceirizado_sem_valor')),
    pendencia: booleano(form.get('pendencia')),
    observacao: textoOuNulo(form.get('observacao')),
    ordem: numeroOuNulo(form.get('ordem')) ?? 0,
  }

  const { error } = id
    ? await supabase.from('itens_orcamento').update(registro).eq('id', id)
    : await supabase.from('itens_orcamento').insert(registro)

  if (error) return { erro: error.message }

  await recalcularTotal(orcamento_id)
  revalidatePath(`/obras/${obra_id}/orcamentos/${orcamento_id}`)
  return { ok: id ? 'Item atualizado.' : 'Item adicionado.' }
}

/** Traz uma composicao da base referencial para dentro do orcamento. */
export async function importarComposicao(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const orcamento_id = textoObrigatorio(form.get('orcamento_id'))
  const obra_id = textoObrigatorio(form.get('obra_id'))
  const preco_id = textoObrigatorio(form.get('preco_id'))

  const { data: preco } = await supabase
    .from('precos_referencia')
    .select('base, codigo, descricao, unidade, preco_unitario')
    .eq('id', preco_id)
    .maybeSingle()

  if (!preco) return

  const { data: ultimo } = await supabase
    .from('itens_orcamento')
    .select('ordem')
    .eq('orcamento_id', orcamento_id)
    .order('ordem', { ascending: false })
    .limit(1)

  await supabase.from('itens_orcamento').insert({
    orcamento_id,
    base_referencia: preco.base,
    codigo_referencia: preco.codigo,
    descricao: preco.descricao,
    unidade: preco.unidade,
    quantidade: 1,
    preco_unitario: Number(preco.preco_unitario ?? 0),
    ordem: Number(ultimo?.[0]?.ordem ?? 0) + 1,
  })

  await recalcularTotal(orcamento_id)
  revalidatePath(`/obras/${obra_id}/orcamentos/${orcamento_id}`)
}

export async function arquivarItem(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const orcamento_id = textoObrigatorio(form.get('orcamento_id'))
  const obra_id = textoObrigatorio(form.get('obra_id'))

  await supabase
    .from('itens_orcamento')
    .update({ excluido_em: new Date().toISOString() })
    .eq('id', textoObrigatorio(form.get('id')))

  await recalcularTotal(orcamento_id)
  revalidatePath(`/obras/${obra_id}/orcamentos/${orcamento_id}`)
}

export async function arquivarOrcamento(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const obra_id = textoObrigatorio(form.get('obra_id'))
  await supabase
    .from('orcamentos')
    .update({ excluido_em: new Date().toISOString() })
    .eq('id', textoObrigatorio(form.get('id')))
  revalidatePath(`/obras/${obra_id}/orcamentos`)
}

/**
 * O total gravado no cabecalho serve para a listagem; quem manda no documento e
 * sempre o calculo a partir dos itens.
 */
async function recalcularTotal(orcamentoId: string) {
  const supabase = await criarClienteServidor()

  const [{ data: cabecalho }, { data: itensData }] = await Promise.all([
    supabase.from('orcamentos').select('margem, bdi, modo_bdi').eq('id', orcamentoId).maybeSingle(),
    supabase
      .from('itens_orcamento')
      .select(
        'id, fase, codigo_referencia, base_referencia, descricao, unidade, quantidade, custo_material, custo_mao_obra, preco_unitario, terceirizado_sem_valor, ordem, pendencia',
      )
      .eq('orcamento_id', orcamentoId)
      .is('excluido_em', null),
  ])

  if (!cabecalho) return

  const itens = (itensData ?? [])
    .filter((i) => !i.pendencia)
    .map((i) => ({
      ...i,
      quantidade: i.quantidade === null ? null : Number(i.quantidade),
      custo_material: i.custo_material === null ? null : Number(i.custo_material),
      custo_mao_obra: i.custo_mao_obra === null ? null : Number(i.custo_mao_obra),
      preco_unitario: i.preco_unitario === null ? null : Number(i.preco_unitario),
      ordem: Number(i.ordem ?? 0),
    })) as ItemOrcamento[]

  const calculo = calcularOrcamento(itens, {
    margem: Number(cabecalho.margem ?? 0.3),
    bdi: Number(cabecalho.bdi ?? 0),
    modo_bdi: cabecalho.modo_bdi,
  })

  await supabase.from('orcamentos').update({ total: calculo.totais.total }).eq('id', orcamentoId)
}
