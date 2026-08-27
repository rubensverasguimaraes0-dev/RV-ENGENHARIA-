'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { dataOuNulo, moedaOuZero, textoObrigatorio, textoOuNulo, type EstadoForm } from '@/lib/form'

export async function salvarFuncionario(
  _e: EstadoForm | null,
  form: FormData,
): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const id = textoObrigatorio(form.get('id'))
  const nome = textoObrigatorio(form.get('nome'))
  if (!nome) return { erro: 'Informe o nome.' }

  const tipo = textoObrigatorio(form.get('tipo')) || 'funcionario'
  const registro = {
    nome,
    tipo,
    funcao: textoOuNulo(form.get('funcao')),
    // parceiro nao recebe diaria: recebe participacao no resultado (spec 4.3)
    valor_diaria: tipo === 'parceiro' ? 0 : moedaOuZero(form.get('valor_diaria')),
    telefone: textoOuNulo(form.get('telefone')),
    chave_pix: textoOuNulo(form.get('chave_pix')),
    status: textoObrigatorio(form.get('status')) || 'ativo',
    data_entrada: dataOuNulo(form.get('data_entrada')),
    data_saida: dataOuNulo(form.get('data_saida')),
    observacoes: textoOuNulo(form.get('observacoes')),
  }

  const { error } = id
    ? await supabase.from('funcionarios').update(registro).eq('id', id)
    : await supabase.from('funcionarios').insert(registro)

  if (error) return { erro: error.message }

  revalidatePath('/cadastros/funcionarios')
  return {
    ok: id
      ? 'Cadastro atualizado. A nova diária vale a partir dos próximos lançamentos.'
      : 'Cadastrado.',
  }
}

export async function arquivarFuncionario(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  await supabase
    .from('funcionarios')
    .update({ excluido_em: new Date().toISOString() })
    .eq('id', textoObrigatorio(form.get('id')))
  revalidatePath('/cadastros/funcionarios')
}
