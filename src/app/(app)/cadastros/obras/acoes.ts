'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/supabase/sessao'
import {
  dataOuNulo,
  moedaOuZero,
  numeroOuNulo,
  textoObrigatorio,
  textoOuNulo,
  type EstadoForm,
} from '@/lib/form'

export async function salvarObra(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const id = textoObrigatorio(form.get('id'))
  const nome = textoObrigatorio(form.get('nome'))
  const cliente_id = textoOuNulo(form.get('cliente_id'))
  if (!nome) return { erro: 'Informe o nome da obra.' }
  if (!cliente_id) return { erro: 'Selecione o cliente.' }

  const pct = numeroOuNulo(form.get('percentual_rateio_parceiro'))

  const registro = {
    nome,
    cliente_id,
    // quem paga pode ser diferente do dono do local (spec 4.1)
    cliente_pagador_id: textoOuNulo(form.get('cliente_pagador_id')),
    endereco: textoOuNulo(form.get('endereco')),
    tipo: textoOuNulo(form.get('tipo')),
    forma_contratacao: textoObrigatorio(form.get('forma_contratacao')) || 'diaria',
    data_inicio: dataOuNulo(form.get('data_inicio')),
    data_prevista_fim: dataOuNulo(form.get('data_prevista_fim')),
    status: textoObrigatorio(form.get('status')) || 'em_andamento',
    valor_contrato: moedaOuZero(form.get('valor_contrato')),
    percentual_rateio_parceiro: pct === null ? 0.5 : pct / 100,
    base_rateio_parceiro: textoObrigatorio(form.get('base_rateio_parceiro')) || 'resultado_total',
    observacoes: textoOuNulo(form.get('observacoes')),
  }

  const { error } = id
    ? await supabase.from('obras').update(registro).eq('id', id)
    : await supabase.from('obras').insert(registro)

  if (error) return { erro: error.message }

  revalidatePath('/cadastros/obras')
  revalidatePath('/obras')
  return { ok: id ? 'Obra atualizada.' : 'Obra cadastrada.' }
}

export async function salvarLocal(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const obra_id = textoObrigatorio(form.get('obra_id'))
  const nome = textoObrigatorio(form.get('nome'))
  if (!obra_id || !nome) return { erro: 'Informe o nome do local.' }

  const { error } = await supabase
    .from('locais_obra')
    .insert({ obra_id, nome, endereco: textoOuNulo(form.get('endereco')) })

  if (error) return { erro: error.message }

  revalidatePath('/cadastros/obras')
  return { ok: 'Local adicionado.' }
}

export async function arquivarLocal(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  await supabase
    .from('locais_obra')
    .update({ excluido_em: new Date().toISOString() })
    .eq('id', textoObrigatorio(form.get('id')))
  revalidatePath('/cadastros/obras')
}

export async function arquivarObra(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  await supabase
    .from('obras')
    .update({ excluido_em: new Date().toISOString() })
    .eq('id', textoObrigatorio(form.get('id')))
  revalidatePath('/cadastros/obras')
  revalidatePath('/obras')
}
