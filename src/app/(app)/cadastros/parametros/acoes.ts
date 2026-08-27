'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { lerMoeda, lerNumero } from '@/lib/format'
import { textoObrigatorio, type EstadoForm } from '@/lib/form'

/** Chaves gravadas em centavos — entram no formulario em reais. */
const EM_CENTAVOS = new Set([
  'valor_quentinha_padrao',
  'solar_tarifa_fio_b',
  'solar_projeto_art',
  'solar_mao_obra_kwp',
])

/** Chaves gravadas como fracao (0,5) e editadas como percentual (50). */
const EM_PERCENTUAL = new Set([
  'percentual_meia_diaria',
  'percentual_rateio_parceiro',
  'margem_padrao',
  'bdi_padrao',
  'solar_margem',
])

export async function salvarParametros(
  _e: EstadoForm | null,
  form: FormData,
): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const atualizacoes: { chave: string; valor: string }[] = []

  for (const [campo, bruto] of form.entries()) {
    if (!campo.startsWith('p_')) continue
    const chave = campo.slice(2)
    const texto = String(bruto ?? '').trim()

    let valor = texto
    if (EM_CENTAVOS.has(chave)) {
      const c = lerMoeda(texto)
      if (c === null) return { erro: `Valor inválido em "${chave}".` }
      valor = String(c)
    } else if (EM_PERCENTUAL.has(chave)) {
      const n = lerNumero(texto)
      if (n === null) return { erro: `Percentual inválido em "${chave}".` }
      valor = String(n / 100)
    }
    atualizacoes.push({ chave, valor })
  }

  for (const a of atualizacoes) {
    const { error } = await supabase
      .from('parametros')
      .update({ valor: a.valor })
      .eq('chave', a.chave)
    if (error) return { erro: error.message }
  }

  revalidatePath('/cadastros/parametros')
  return { ok: `${atualizacoes.length} parâmetro(s) salvos.` }
}

export async function criarParametro(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const chave = textoObrigatorio(form.get('chave'))
  if (!chave) return { erro: 'Informe a chave.' }
  const { error } = await supabase.from('parametros').insert({
    chave,
    valor: textoObrigatorio(form.get('valor')),
    descricao: textoObrigatorio(form.get('descricao')) || null,
  })
  if (error) return { erro: error.message }
  revalidatePath('/cadastros/parametros')
  return { ok: 'Parâmetro criado.' }
}
