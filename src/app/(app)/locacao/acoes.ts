'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { coluna, lerCSV } from '@/lib/csv'
import { lerMoeda, lerNumero, hojeISO } from '@/lib/format'
import {
  booleano,
  dataOuNulo,
  moedaOuNulo,
  moedaOuZero,
  numeroOuNulo,
  textoObrigatorio,
  textoOuNulo,
  type EstadoForm,
} from '@/lib/form'
import { apurarContrato } from '@/lib/domain/locacao'

export async function salvarEquipamento(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const id = textoObrigatorio(form.get('id'))
  const descricao = textoObrigatorio(form.get('descricao'))
  if (!descricao) return { erro: 'Descreva o equipamento.' }

  const registro = {
    descricao,
    categoria: textoOuNulo(form.get('categoria')),
    patrimonio: textoOuNulo(form.get('patrimonio')),
    quantidade_estoque: numeroOuNulo(form.get('quantidade_estoque')) ?? 1,
    valor_compra: moedaOuNulo(form.get('valor_compra')),
    status: textoObrigatorio(form.get('status')) || 'disponivel',
  }

  const { data, error } = id
    ? await supabase.from('equipamentos').update(registro).eq('id', id).select('id').single()
    : await supabase.from('equipamentos').insert(registro).select('id').single()

  if (error) return { erro: error.message }

  // A tabela de precos e um registro por equipamento
  const precos = {
    equipamento_id: data.id as string,
    valor_diaria: moedaOuZero(form.get('valor_diaria')),
    valor_semana: moedaOuZero(form.get('valor_semana')),
    valor_mes: moedaOuZero(form.get('valor_mes')),
  }

  const { data: existente } = await supabase
    .from('tabela_locacao')
    .select('id')
    .eq('equipamento_id', data.id)
    .is('excluido_em', null)
    .maybeSingle()

  const { error: erroPreco } = existente
    ? await supabase.from('tabela_locacao').update(precos).eq('id', existente.id)
    : await supabase.from('tabela_locacao').insert(precos)

  if (erroPreco) return { erro: erroPreco.message }

  revalidatePath('/locacao/equipamentos')
  return { ok: id ? 'Equipamento atualizado.' : 'Equipamento cadastrado.' }
}

/** Importa a tabela de precos por CSV — sao cerca de 85 itens ja levantados. */
export async function importarTabelaPrecos(
  _e: EstadoForm | null,
  form: FormData,
): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const arquivo = form.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: 'Escolha o arquivo CSV.' }

  const linhas = lerCSV(await arquivo.text())
  if (linhas.length === 0) return { erro: 'O arquivo não tem linhas de dados.' }

  let criados = 0
  let atualizados = 0
  let ignoradas = 0

  for (const linha of linhas) {
    const descricao = coluna(linha, 'descricao', 'equipamento', 'item')
    if (!descricao) {
      ignoradas++
      continue
    }

    const equipamento = {
      descricao,
      categoria: coluna(linha, 'categoria', 'grupo', 'tipo') || null,
      patrimonio: coluna(linha, 'patrimonio', 'numero de patrimonio') || null,
      quantidade_estoque: lerNumero(coluna(linha, 'quantidade', 'estoque', 'qtd')) ?? 1,
      valor_compra: lerMoeda(coluna(linha, 'valor de compra', 'valor compra')),
    }

    const { data: existente } = await supabase
      .from('equipamentos')
      .select('id')
      .eq('descricao', descricao)
      .is('excluido_em', null)
      .maybeSingle()

    let equipamentoId: string
    if (existente) {
      await supabase.from('equipamentos').update(equipamento).eq('id', existente.id)
      equipamentoId = existente.id as string
      atualizados++
    } else {
      const { data: novo, error } = await supabase
        .from('equipamentos')
        .insert(equipamento)
        .select('id')
        .single()
      if (error) return { erro: `${criados} criado(s) e a importação parou: ${error.message}` }
      equipamentoId = novo.id as string
      criados++
    }

    const precos = {
      equipamento_id: equipamentoId,
      valor_diaria: lerMoeda(coluna(linha, 'diaria', 'valor diaria', 'dia')) ?? 0,
      valor_semana: lerMoeda(coluna(linha, 'semana', 'valor semana', 'semanal')) ?? 0,
      valor_mes: lerMoeda(coluna(linha, 'mes', 'valor mes', 'mensal')) ?? 0,
    }

    const { data: tabelaExistente } = await supabase
      .from('tabela_locacao')
      .select('id')
      .eq('equipamento_id', equipamentoId)
      .is('excluido_em', null)
      .maybeSingle()

    if (tabelaExistente) {
      await supabase.from('tabela_locacao').update(precos).eq('id', tabelaExistente.id)
    } else {
      await supabase.from('tabela_locacao').insert(precos)
    }
  }

  revalidatePath('/locacao/equipamentos')
  return {
    ok:
      `${criados} equipamento(s) criado(s), ${atualizados} atualizado(s)` +
      (ignoradas > 0 ? `; ${ignoradas} linha(s) ignorada(s) por falta de descrição.` : '.'),
  }
}

export async function criarContrato(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const uso_interno = booleano(form.get('uso_interno'))
  const cliente_id = textoOuNulo(form.get('cliente_id'))
  const obra_id = textoOuNulo(form.get('obra_id'))
  const equipamentos = form.getAll('equipamento_id').map(String).filter(Boolean)

  if (!uso_interno && !cliente_id) return { erro: 'Selecione o cliente, ou marque uso interno.' }
  if (uso_interno && !obra_id) return { erro: 'No uso interno, informe a obra que recebe o custo.' }
  if (equipamentos.length === 0) return { erro: 'Selecione ao menos um equipamento.' }

  const { data, error } = await supabase
    .from('contratos_locacao')
    .insert({
      cliente_id: uso_interno ? null : cliente_id,
      obra_id,
      uso_interno,
      data_saida: dataOuNulo(form.get('data_saida')) ?? hojeISO(),
      data_prevista: dataOuNulo(form.get('data_prevista')),
      caucao: moedaOuZero(form.get('caucao')),
      forma_pagamento: textoOuNulo(form.get('forma_pagamento')),
      observacao: textoOuNulo(form.get('observacao')),
    })
    .select('id')
    .single()

  if (error) return { erro: error.message }

  const { error: erroItens } = await supabase.from('itens_contrato_locacao').insert(
    equipamentos.map((equipamento_id) => ({
      contrato_id: data.id,
      equipamento_id,
      quantidade: numeroOuNulo(form.get(`quantidade_${equipamento_id}`)) ?? 1,
    })),
  )
  if (erroItens) return { erro: erroItens.message }

  // Equipamento sai do estoque enquanto o contrato estiver aberto.
  await supabase.from('equipamentos').update({ status: 'locado' }).in('id', equipamentos)

  revalidatePath('/locacao')
  redirect(`/locacao/${data.id}`)
}

/** Devolucao: data efetiva, estado do equipamento e cobranca das diarias adicionais. */
export async function registrarDevolucao(
  _e: EstadoForm | null,
  form: FormData,
): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const id = textoObrigatorio(form.get('id'))
  const data_devolucao = dataOuNulo(form.get('data_devolucao')) ?? hojeISO()

  const { carregarContrato } = await import('@/lib/dados/locacao')
  const contrato = await carregarContrato(id)
  if (!contrato) return { erro: 'Contrato não encontrado.' }

  // Recalcula com a data efetiva, para gravar o valor que sera cobrado.
  const apuracao = apurarContrato({
    itens: contrato.itens,
    data_saida: contrato.data_saida,
    data_prevista: contrato.data_prevista,
    data_devolucao,
    hoje: hojeISO(),
  })

  const { error } = await supabase
    .from('contratos_locacao')
    .update({
      data_devolucao,
      valor: apuracao.valor_total,
      status: 'devolvido',
      observacao: textoOuNulo(form.get('observacao')) ?? contrato.observacao,
    })
    .eq('id', id)

  if (error) return { erro: error.message }

  // Estado de cada equipamento na devolucao
  for (const item of contrato.itens) {
    const estado = textoOuNulo(form.get(`estado_${item.id}`))
    if (estado) {
      await supabase.from('itens_contrato_locacao').update({ estado_devolucao: estado }).eq('id', item.id)
    }
  }

  await supabase
    .from('equipamentos')
    .update({ status: 'disponivel' })
    .in(
      'id',
      contrato.itens.map((i) => i.equipamento_id),
    )

  revalidatePath('/locacao')
  revalidatePath(`/locacao/${id}`)
  return {
    ok:
      apuracao.dias_adicionais > 0
        ? `Devolução registrada com ${apuracao.dias_adicionais} dia(s) adicional(is) cobrado(s).`
        : 'Devolução registrada no prazo.',
  }
}

export async function arquivarEquipamento(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  await supabase
    .from('equipamentos')
    .update({ excluido_em: new Date().toISOString() })
    .eq('id', textoObrigatorio(form.get('id')))
  revalidatePath('/locacao/equipamentos')
}

export async function cancelarContrato(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const id = textoObrigatorio(form.get('id'))

  const { carregarContrato } = await import('@/lib/dados/locacao')
  const contrato = await carregarContrato(id)

  await supabase.from('contratos_locacao').update({ status: 'cancelado' }).eq('id', id)

  if (contrato) {
    await supabase
      .from('equipamentos')
      .update({ status: 'disponivel' })
      .in(
        'id',
        contrato.itens.map((i) => i.equipamento_id),
      )
  }

  revalidatePath('/locacao')
}
