'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { textoObrigatorio, type EstadoForm } from '@/lib/form'
import { diasDaSemana } from '@/lib/format'

/**
 * Fecha a semana marcando os dias sem expediente (spec 4.5: houve semana
 * encerrada na quinta e semana encerrada na sexta, sem expediente no sabado).
 */
export async function fecharSemana(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const semanaId = textoObrigatorio(form.get('semana_id'))
  const obraId = textoObrigatorio(form.get('obra_id'))
  const dataInicio = textoObrigatorio(form.get('data_inicio'))

  const semExpediente = diasDaSemana(dataInicio).filter((d) => form.get(`sem_expediente_${d}`))

  const { error } = await supabase
    .from('semanas')
    .update({
      status: 'fechada',
      fechada_em: new Date().toISOString(),
      dias_sem_expediente_json: semExpediente,
    })
    .eq('id', semanaId)

  if (error) return { erro: error.message }

  revalidatePath(`/obras/${obraId}/semanas`)
  revalidatePath(`/obras/${obraId}/semanas/${semanaId}`)
  return { ok: 'Semana fechada.' }
}

export async function reabrirSemana(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const semanaId = textoObrigatorio(form.get('semana_id'))
  const obraId = textoObrigatorio(form.get('obra_id'))

  await supabase
    .from('semanas')
    .update({ status: 'aberta', fechada_em: null })
    .eq('id', semanaId)

  revalidatePath(`/obras/${obraId}/semanas`)
  revalidatePath(`/obras/${obraId}/semanas/${semanaId}`)
}

/** Marca ou desmarca um dia como sem expediente com a semana ainda aberta. */
export async function alternarDiaSemExpediente(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const semanaId = textoObrigatorio(form.get('semana_id'))
  const obraId = textoObrigatorio(form.get('obra_id'))
  const dia = textoObrigatorio(form.get('dia'))

  const { data } = await supabase
    .from('semanas')
    .select('dias_sem_expediente_json')
    .eq('id', semanaId)
    .maybeSingle()

  const atuais: string[] = Array.isArray(data?.dias_sem_expediente_json)
    ? (data.dias_sem_expediente_json as string[])
    : []
  const novos = atuais.includes(dia) ? atuais.filter((d) => d !== dia) : [...atuais, dia].sort()

  await supabase.from('semanas').update({ dias_sem_expediente_json: novos }).eq('id', semanaId)

  revalidatePath(`/obras/${obraId}/semanas/${semanaId}`)
}
