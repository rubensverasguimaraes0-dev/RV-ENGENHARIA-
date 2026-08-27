'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { exigirAdmin, exigirUsuario } from '@/lib/supabase/sessao'
import {
  booleano,
  dataOuNulo,
  moedaOuZero,
  textoObrigatorio,
  textoOuNulo,
  type EstadoForm,
} from '@/lib/form'
import { hojeISO } from '@/lib/format'

export interface RetornoNota extends EstadoForm {
  notaId?: string
}

/**
 * Grava a nota fiscal. As fotos ja foram enviadas ao Storage pelo navegador e
 * chegam aqui como caminhos; a nota so vale em relatorio se tiver pelo menos
 * uma (spec 4.7), o que e conferido na geracao do documento.
 */
export async function salvarNota(_e: RetornoNota | null, form: FormData): Promise<RetornoNota> {
  await exigirUsuario()
  const supabase = await criarClienteServidor()

  const obra_id = textoObrigatorio(form.get('obra_id'))
  const id = textoObrigatorio(form.get('id'))
  const data = dataOuNulo(form.get('data')) ?? hojeISO()
  const valor = moedaOuZero(form.get('valor'))

  if (!obra_id) return { erro: 'Obra não informada.' }
  if (valor <= 0) return { erro: 'Informe o valor da nota.' }

  // a semana e sugerida pela data da nota
  const { data: semanaId } = await supabase.rpc('garantir_semana', {
    p_obra_id: obra_id,
    p_data: data,
  })

  const registro = {
    obra_id,
    local_id: textoOuNulo(form.get('local_id')),
    semana_id: (semanaId as string) ?? null,
    data,
    fornecedor_id: textoOuNulo(form.get('fornecedor_id')),
    fornecedor_nome: textoOuNulo(form.get('fornecedor_nome')),
    numero_nota: textoOuNulo(form.get('numero_nota')),
    categoria: textoObrigatorio(form.get('categoria')) || 'material',
    descricao: textoOuNulo(form.get('descricao')),
    valor,
    forma_pagamento: textoOuNulo(form.get('forma_pagamento')),
    // nota paga pelo cliente na loja nao entra no valor a repassar
    pago_por: textoObrigatorio(form.get('pago_por')) || 'rv',
    anotacao_interna: textoOuNulo(form.get('anotacao_interna')),
    a_confirmar: booleano(form.get('a_confirmar')),
  }

  const { data: salva, error } = id
    ? await supabase.from('notas_fiscais').update(registro).eq('id', id).select('id').single()
    : await supabase.from('notas_fiscais').insert(registro).select('id').single()

  if (error) return { erro: error.message }
  const notaId = salva.id as string

  const caminhos = form.getAll('foto').map(String).filter(Boolean)
  if (caminhos.length > 0) {
    const { error: erroFoto } = await supabase.from('fotos_nota').insert(
      caminhos.map((arquivo_url, ordem) => ({ nota_id: notaId, arquivo_url, ordem })),
    )
    if (erroFoto) return { erro: `Nota salva, mas as fotos falharam: ${erroFoto.message}` }
  }

  revalidatePath(`/obras/${obra_id}/notas`)
  return { ok: 'Nota lançada.', notaId }
}

export async function alternarConferida(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const id = textoObrigatorio(form.get('id'))
  const obraId = textoObrigatorio(form.get('obra_id'))
  const conferida = booleano(form.get('conferida'))

  await supabase.from('notas_fiscais').update({ conferida: !conferida }).eq('id', id)
  revalidatePath(`/obras/${obraId}/notas`)
}

export async function alternarAConfirmar(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const id = textoObrigatorio(form.get('id'))
  const obraId = textoObrigatorio(form.get('obra_id'))
  const atual = booleano(form.get('a_confirmar'))

  await supabase.from('notas_fiscais').update({ a_confirmar: !atual }).eq('id', id)
  revalidatePath(`/obras/${obraId}/notas`)
}

export async function arquivarNota(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const obraId = textoObrigatorio(form.get('obra_id'))
  await supabase
    .from('notas_fiscais')
    .update({ excluido_em: new Date().toISOString() })
    .eq('id', textoObrigatorio(form.get('id')))
  revalidatePath(`/obras/${obraId}/notas`)
}

/** Marca as notas da semana como repassadas ao cliente, na data informada. */
export async function marcarRepassadas(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const obraId = textoObrigatorio(form.get('obra_id'))
  const ids = form.getAll('nota_id').map(String).filter(Boolean)
  const data = dataOuNulo(form.get('repassada_em')) ?? hojeISO()

  if (ids.length === 0) return { erro: 'Nenhuma nota selecionada.' }

  const { error } = await supabase
    .from('notas_fiscais')
    .update({ repassada_em: data })
    .in('id', ids)

  if (error) return { erro: error.message }

  revalidatePath(`/obras/${obraId}/notas`)
  return { ok: `${ids.length} nota(s) marcadas como repassadas.` }
}

/** Rateio da nota entre locais: as partes precisam fechar com o valor da nota. */
export async function salvarRateio(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const notaId = textoObrigatorio(form.get('nota_id'))
  const obraId = textoObrigatorio(form.get('obra_id'))
  const valorNota = moedaOuZero(form.get('valor_nota'))

  const partes: { local_id: string; valor: number }[] = []
  for (const [campo, bruto] of form.entries()) {
    if (!campo.startsWith('parte_')) continue
    const valor = moedaOuZero(bruto)
    if (valor > 0) partes.push({ local_id: campo.slice(6), valor })
  }

  const soma = partes.reduce((s, p) => s + p.valor, 0)
  if (partes.length > 0 && soma !== valorNota) {
    return {
      erro: `As partes somam um valor diferente da nota. Faltam ${((valorNota - soma) / 100)
        .toFixed(2)
        .replace('.', ',')}.`,
    }
  }

  await supabase.from('rateio_nota').delete().eq('nota_id', notaId)
  if (partes.length > 0) {
    const { error } = await supabase.from('rateio_nota').insert(
      partes.map((p) => ({ nota_id: notaId, obra_id: obraId, local_id: p.local_id, valor: p.valor })),
    )
    if (error) return { erro: error.message }
  }

  revalidatePath(`/obras/${obraId}/notas`)
  return { ok: partes.length === 0 ? 'Rateio removido.' : 'Rateio salvo.' }
}

/** Despesa sem nota fiscal — entra no custo e não no repasse (spec 4.6). */
export async function salvarDespesa(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const obra_id = textoObrigatorio(form.get('obra_id'))
  const descricao = textoObrigatorio(form.get('descricao'))
  const valor = moedaOuZero(form.get('valor'))
  if (!descricao) return { erro: 'Descreva a despesa.' }
  if (valor <= 0) return { erro: 'Informe o valor.' }

  const data = dataOuNulo(form.get('data')) ?? hojeISO()
  const { data: semanaId } = await supabase.rpc('garantir_semana', {
    p_obra_id: obra_id,
    p_data: data,
  })

  const { error } = await supabase.from('despesas_sem_nota').insert({
    obra_id,
    semana_id: (semanaId as string) ?? null,
    local_id: textoOuNulo(form.get('local_id')),
    data,
    descricao,
    categoria: textoObrigatorio(form.get('categoria')) || 'outro',
    valor,
    pago_a: textoOuNulo(form.get('pago_a')),
    repassar_cliente: booleano(form.get('repassar_cliente')),
  })

  if (error) return { erro: error.message }

  revalidatePath(`/obras/${obra_id}/notas`)
  return { ok: 'Despesa lançada.' }
}
