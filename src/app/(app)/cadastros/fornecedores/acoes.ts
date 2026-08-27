'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { textoObrigatorio, textoOuNulo, type EstadoForm } from '@/lib/form'

export async function salvarFornecedor(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const id = textoObrigatorio(form.get('id'))
  const nome = textoObrigatorio(form.get('nome'))
  if (!nome) return { erro: 'Informe o nome do fornecedor.' }

  const registro = {
    nome,
    contato: textoOuNulo(form.get('contato')),
    categoria: textoOuNulo(form.get('categoria')),
    condicao_pagamento: textoOuNulo(form.get('condicao_pagamento')),
  }
  const { error } = id
    ? await supabase.from('fornecedores').update(registro).eq('id', id)
    : await supabase.from('fornecedores').insert(registro)
  if (error) return { erro: error.message }

  revalidatePath('/cadastros/fornecedores')
  return { ok: 'Fornecedor salvo.' }
}

export async function salvarTerceiro(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const id = textoObrigatorio(form.get('id'))
  const nome = textoObrigatorio(form.get('nome'))
  if (!nome) return { erro: 'Informe o nome do terceiro.' }

  const registro = {
    nome,
    atividade: textoOuNulo(form.get('atividade')),
    contato: textoOuNulo(form.get('contato')),
    forma_cobranca: textoOuNulo(form.get('forma_cobranca')),
  }
  const { error } = id
    ? await supabase.from('terceiros').update(registro).eq('id', id)
    : await supabase.from('terceiros').insert(registro)
  if (error) return { erro: error.message }

  revalidatePath('/cadastros/terceiros')
  return { ok: 'Terceiro salvo.' }
}
