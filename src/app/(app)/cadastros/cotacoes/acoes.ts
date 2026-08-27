'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { coluna, lerCSV } from '@/lib/csv'
import { lerMoeda, lerNumero } from '@/lib/format'
import {
  booleano,
  dataOuNulo,
  moedaOuZero,
  numeroOuNulo,
  textoObrigatorio,
  textoOuNulo,
  type EstadoForm,
} from '@/lib/form'
import { totalDaCotacao } from '@/lib/domain/cotacoes'
import type { ItemCotacao } from '@/lib/domain/cotacoes'

export async function criarCotacao(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const fornecedor_id = textoObrigatorio(form.get('fornecedor_id'))
  if (!fornecedor_id) return { erro: 'Selecione o fornecedor.' }

  const { data, error } = await supabase
    .from('cotacoes')
    .insert({
      fornecedor_id,
      numero_documento: textoOuNulo(form.get('numero_documento')),
      data: dataOuNulo(form.get('data')),
      vendedor: textoOuNulo(form.get('vendedor')),
      validade: dataOuNulo(form.get('validade')),
      condicao_pagamento: textoOuNulo(form.get('condicao_pagamento')),
      total: moedaOuZero(form.get('total')),
    })
    .select('id')
    .single()

  if (error) return { erro: error.message }

  revalidatePath('/cadastros/cotacoes')
  redirect(`/cadastros/cotacoes/${data.id}`)
}

export async function salvarItemCotacao(
  _e: EstadoForm | null,
  form: FormData,
): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const cotacao_id = textoObrigatorio(form.get('cotacao_id'))
  const id = textoObrigatorio(form.get('id'))
  const categoria = textoObrigatorio(form.get('categoria'))
  if (!categoria) return { erro: 'Informe a categoria do item.' }

  const registro = {
    cotacao_id,
    categoria,
    marca: textoOuNulo(form.get('marca')),
    modelo: textoOuNulo(form.get('modelo')),
    especificacao: textoOuNulo(form.get('especificacao')),
    unidade: textoOuNulo(form.get('unidade')),
    quantidade: numeroOuNulo(form.get('quantidade')),
    preco_unitario: moedaOuZero(form.get('preco_unitario')),
    estimado: booleano(form.get('estimado')),
    substituido: booleano(form.get('substituido')),
  }

  const { error } = id
    ? await supabase.from('itens_cotacao').update(registro).eq('id', id)
    : await supabase.from('itens_cotacao').insert(registro)

  if (error) return { erro: error.message }

  revalidatePath(`/cadastros/cotacoes/${cotacao_id}`)
  return { ok: id ? 'Item atualizado.' : 'Item adicionado.' }
}

/** Entrada rapida: varios itens de um fornecedor de uma vez, por CSV (spec 5.6). */
export async function importarItensCSV(
  _e: EstadoForm | null,
  form: FormData,
): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const cotacao_id = textoObrigatorio(form.get('cotacao_id'))
  const arquivo = form.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: 'Escolha o arquivo CSV.' }

  const linhas = lerCSV(await arquivo.text())
  if (linhas.length === 0) return { erro: 'O arquivo não tem linhas de dados.' }

  const registros = []
  let ignoradas = 0

  for (const linha of linhas) {
    const preco = lerMoeda(coluna(linha, 'preco unitario', 'preco', 'valor', 'valor unitario'))
    const categoria = coluna(linha, 'categoria', 'tipo', 'grupo')
    const modelo = coluna(linha, 'modelo', 'descricao', 'produto', 'item')

    if (preco === null || (!categoria && !modelo)) {
      ignoradas++
      continue
    }

    registros.push({
      cotacao_id,
      categoria: categoria || 'outro',
      marca: coluna(linha, 'marca', 'fabricante') || null,
      modelo: modelo || null,
      especificacao: coluna(linha, 'especificacao', 'potencia', 'bitola', 'spec') || null,
      unidade: coluna(linha, 'unidade', 'und', 'un') || null,
      quantidade: lerNumero(coluna(linha, 'quantidade', 'qtd', 'qtde')),
      preco_unitario: preco,
      estimado: /sim|1|true/i.test(coluna(linha, 'estimado')),
      substituido: /sim|1|true/i.test(coluna(linha, 'substituido')),
    })
  }

  if (registros.length === 0) {
    return { erro: 'Nenhuma linha aproveitável. São necessárias colunas de item e preço unitário.' }
  }

  const { error } = await supabase.from('itens_cotacao').insert(registros)
  if (error) return { erro: error.message }

  await recalcularTotal(cotacao_id)
  revalidatePath(`/cadastros/cotacoes/${cotacao_id}`)
  return {
    ok:
      `${registros.length} item(ns) importado(s)` +
      (ignoradas > 0 ? `; ${ignoradas} linha(s) ignorada(s).` : '.'),
  }
}

/** Marca a cotacao como base para apurar o custo do servico (spec 6.1). */
export async function alternarBase(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const id = textoObrigatorio(form.get('id'))
  const atual = booleano(form.get('base'))

  await supabase.from('cotacoes').update({ base: !atual }).eq('id', id)
  revalidatePath('/cadastros/cotacoes')
  revalidatePath(`/cadastros/cotacoes/${id}`)
}

export async function arquivarItemCotacao(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const cotacao_id = textoObrigatorio(form.get('cotacao_id'))
  await supabase
    .from('itens_cotacao')
    .update({ excluido_em: new Date().toISOString() })
    .eq('id', textoObrigatorio(form.get('id')))
  await recalcularTotal(cotacao_id)
  revalidatePath(`/cadastros/cotacoes/${cotacao_id}`)
}

export async function arquivarCotacao(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  await supabase
    .from('cotacoes')
    .update({ excluido_em: new Date().toISOString() })
    .eq('id', textoObrigatorio(form.get('id')))
  revalidatePath('/cadastros/cotacoes')
}

/**
 * Atualiza o total pelos itens. O total informado no documento do fornecedor
 * fica no cabecalho e serve de conferencia — os dois aparecem lado a lado.
 */
async function recalcularTotal(cotacaoId: string) {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('itens_cotacao')
    .select('quantidade, preco_unitario')
    .eq('cotacao_id', cotacaoId)
    .is('excluido_em', null)

  const itens = (data ?? []).map((i) => ({
    quantidade: i.quantidade === null ? null : Number(i.quantidade),
    preco_unitario: Number(i.preco_unitario ?? 0),
  })) as ItemCotacao[]

  const total = totalDaCotacao(itens)
  const { data: cabecalho } = await supabase
    .from('cotacoes')
    .select('total')
    .eq('id', cotacaoId)
    .maybeSingle()

  // so preenche o total quando ele ainda nao foi informado a mao
  if (!cabecalho?.total) {
    await supabase.from('cotacoes').update({ total }).eq('id', cotacaoId)
  }
}
