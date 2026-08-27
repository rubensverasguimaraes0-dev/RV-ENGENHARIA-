'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/supabase/sessao'
import {
  moedaOuZero,
  numeroOuNulo,
  textoObrigatorio,
  textoOuNulo,
  type EstadoForm,
} from '@/lib/form'
import { lerNumero } from '@/lib/format'

const MESES = 12

export async function criarProjetoSolar(
  _e: EstadoForm | null,
  form: FormData,
): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const cliente_id = textoObrigatorio(form.get('cliente_id'))
  if (!cliente_id) return { erro: 'Selecione o cliente.' }

  const { data, error } = await supabase
    .from('projetos_solar')
    .insert({
      cliente_id,
      uc: textoOuNulo(form.get('uc')),
      concessionaria: textoOuNulo(form.get('concessionaria')),
      tipo_ligacao: textoObrigatorio(form.get('tipo_ligacao')) || 'monofasica',
      tarifa: moedaOuZero(form.get('tarifa')),
      consumo_mensal_json: lerConsumo(form),
      tipo_telhado: textoOuNulo(form.get('tipo_telhado')),
      distancia_quadro: numeroOuNulo(form.get('distancia_quadro')),
      anexo_conta_url: textoOuNulo(form.get('anexo')),
    })
    .select('id')
    .single()

  if (error) return { erro: error.message }

  revalidatePath('/solar')
  redirect(`/solar/${data.id}`)
}

export async function salvarProjetoSolar(
  _e: EstadoForm | null,
  form: FormData,
): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const id = textoObrigatorio(form.get('id'))
  const margemPct = numeroOuNulo(form.get('margem'))
  const anexo = textoOuNulo(form.get('anexo'))

  const { error } = await supabase
    .from('projetos_solar')
    .update({
      uc: textoOuNulo(form.get('uc')),
      concessionaria: textoOuNulo(form.get('concessionaria')),
      tipo_ligacao: textoObrigatorio(form.get('tipo_ligacao')) || 'monofasica',
      tarifa: moedaOuZero(form.get('tarifa')),
      consumo_mensal_json: lerConsumo(form),
      tipo_telhado: textoOuNulo(form.get('tipo_telhado')),
      distancia_quadro: numeroOuNulo(form.get('distancia_quadro')),
      status: textoObrigatorio(form.get('status')) || 'rascunho',
      ...(margemPct !== null ? { margem: margemPct / 100 } : {}),
      ...(anexo ? { anexo_conta_url: anexo } : {}),
    })
    .eq('id', id)

  if (error) return { erro: error.message }

  revalidatePath(`/solar/${id}`)
  return { ok: 'Projeto atualizado.' }
}

/**
 * Congela no projeto o dimensionamento e os valores da cotacao do momento.
 * A proposta enviada ao cliente nao pode mudar sozinha quando o preco do
 * fornecedor mudar na semana seguinte.
 */
export async function congelarCotacao(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const id = textoObrigatorio(form.get('id'))
  const { carregarProjetoSolar } = await import('@/lib/dados/solar')
  const dados = await carregarProjetoSolar(id)
  if (!dados) return

  await supabase
    .from('projetos_solar')
    .update({
      potencia_kwp: dados.dimensionamento.potencia_instalada_kwp,
      qtd_modulos: dados.dimensionamento.qtd_modulos,
      geracao_estimada: dados.dimensionamento.geracao_mensal_estimada,
      modelo_modulo: dados.cotacao.itens.find((i) => i.categoria === 'modulo')?.descricao ?? null,
      modelo_inversor: dados.cotacao.itens.find((i) => i.categoria === 'inversor')?.descricao ?? null,
      custo_total: dados.cotacao.custo_total,
      preco_venda: dados.cotacao.preco_venda,
      margem: dados.parametros.margem,
      status: 'cotado',
    })
    .eq('id', id)

  // Os itens da cotacao ficam gravados para o historico da proposta.
  await supabase.from('itens_projeto_solar').delete().eq('projeto_id', id)
  await supabase.from('itens_projeto_solar').insert(
    dados.cotacao.itens.map((item, ordem) => ({
      projeto_id: id,
      descricao: item.descricao,
      quantidade: item.quantidade,
      preco_unitario: item.custo_unitario,
      total: item.custo_total,
      ordem,
    })),
  )

  revalidatePath(`/solar/${id}`)
}

export async function arquivarProjetoSolar(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  await supabase
    .from('projetos_solar')
    .update({ excluido_em: new Date().toISOString() })
    .eq('id', textoObrigatorio(form.get('id')))
  revalidatePath('/solar')
}

/**
 * Le o consumo dos 12 meses, ou apenas a media quando so ela foi informada
 * (spec 5.2: "mes a mes ou apenas a media").
 */
function lerConsumo(form: FormData): number[] {
  const meses: number[] = []
  for (let i = 0; i < MESES; i++) {
    const valor = lerNumero(String(form.get(`consumo_${i}`) ?? ''))
    if (valor !== null && valor > 0) meses.push(valor)
  }
  if (meses.length > 0) return meses

  const media = lerNumero(String(form.get('consumo_medio') ?? ''))
  return media !== null && media > 0 ? [media] : []
}
