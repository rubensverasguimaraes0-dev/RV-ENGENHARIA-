'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { textoObrigatorio, textoOuNulo, type EstadoForm } from '@/lib/form'

export async function salvarCliente(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const id = textoObrigatorio(form.get('id'))
  const nome = textoObrigatorio(form.get('nome'))
  if (!nome) return { erro: 'Informe o nome ou a razão social.' }

  const registro = {
    nome,
    // razao social que aparece no comprovante, nem sempre igual ao nome conhecido
    razao_social_comprovante: textoOuNulo(form.get('razao_social_comprovante')),
    documento: textoOuNulo(form.get('documento')),
    telefone: textoOuNulo(form.get('telefone')),
    email: textoOuNulo(form.get('email')),
    endereco: textoOuNulo(form.get('endereco')),
    // unidade filha de um grupo (ex.: 4 padarias + 1 hortifruti)
    cliente_pai_id: textoOuNulo(form.get('cliente_pai_id')),
    observacoes: textoOuNulo(form.get('observacoes')),
  }

  const { error } = id
    ? await supabase.from('clientes').update(registro).eq('id', id)
    : await supabase.from('clientes').insert(registro)

  if (error) return { erro: error.message }

  revalidatePath('/cadastros/clientes')
  return { ok: id ? 'Cliente atualizado.' : 'Cliente cadastrado.' }
}

export async function arquivarCliente(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const id = textoObrigatorio(form.get('id'))
  // exclusao logica: nada e apagado (spec 11.5)
  await supabase.from('clientes').update({ excluido_em: new Date().toISOString() }).eq('id', id)
  revalidatePath('/cadastros/clientes')
}
