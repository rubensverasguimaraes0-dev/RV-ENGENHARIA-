'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/supabase/sessao'
import {
  dataOuNulo,
  moedaOuNulo,
  textoObrigatorio,
  textoOuNulo,
  type EstadoForm,
} from '@/lib/form'
import { hojeISO } from '@/lib/format'

/**
 * Registra o Pix feito ao funcionario, com o comprovante.
 *
 * O valor vem do formulario e nao do fechamento porque acontece de pagar
 * diferente — arredondar para cima, descontar um vale combinado na hora. O que
 * o aplicativo garante e que a diferenca apareca na tela, nao que ela nao
 * exista.
 */
export async function registrarPagamentoFuncionario(
  _e: EstadoForm | null,
  form: FormData,
): Promise<EstadoForm> {
  const usuario = await exigirAdmin()
  const supabase = await criarClienteServidor()

  const obra_id = textoObrigatorio(form.get('obra_id'))
  const semana_id = textoObrigatorio(form.get('semana_id'))
  const funcionario_id = textoObrigatorio(form.get('funcionario_id'))

  const valor = moedaOuNulo(form.get('valor'))
  if (valor === null || valor <= 0) return { erro: 'Informe o valor pago.' }

  const { error } = await supabase.from('pagamentos_funcionario').insert({
    obra_id,
    semana_id,
    funcionario_id,
    valor,
    data_pagamento: dataOuNulo(form.get('data_pagamento')) ?? hojeISO(),
    forma_pagamento: textoOuNulo(form.get('forma_pagamento')),
    comprovante_url: textoOuNulo(form.get('comprovante')),
    observacao: textoOuNulo(form.get('observacao')),
    criado_por: usuario.id,
  })

  if (error) return { erro: error.message }

  revalidatePath(`/obras/${obra_id}/semanas/${semana_id}/pagar`)
  revalidatePath(`/obras/${obra_id}`)
  return { ok: 'Pagamento registrado.' }
}

/**
 * Desfaz um lancamento de pagamento.
 *
 * Exclusao logica: o registro fica no banco com a data de exclusao (spec 11.5).
 * Pagamento apagado de vez seria um buraco justamente no lugar onde o
 * funcionario pode cobrar o que recebeu.
 */
export async function arquivarPagamentoFuncionario(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const id = textoObrigatorio(form.get('id'))
  const obra_id = textoObrigatorio(form.get('obra_id'))
  const semana_id = textoObrigatorio(form.get('semana_id'))

  await supabase
    .from('pagamentos_funcionario')
    .update({ excluido_em: new Date().toISOString() })
    .eq('id', id)

  revalidatePath(`/obras/${obra_id}/semanas/${semana_id}/pagar`)
  revalidatePath(`/obras/${obra_id}`)
}
