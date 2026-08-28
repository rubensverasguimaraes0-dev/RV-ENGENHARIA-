'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { coluna, lerCSV } from '@/lib/csv'
import { hojeISO, lerData, lerMoeda } from '@/lib/format'
import { textoObrigatorio, type EstadoForm } from '@/lib/form'

/**
 * Importa uma tabela de referencia (SINAPI, ORSE ou SICRO) a partir do CSV
 * exportado do Excel. O arquivo real tem acento, ponto e virgula e decimal com
 * virgula; a leitura fica em lib/csv, com teste.
 */
export async function importarPrecos(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const base = textoObrigatorio(form.get('base'))
  const uf = textoObrigatorio(form.get('uf')) || 'PI'
  const dataBaseForm = lerData(String(form.get('data_base') ?? ''))
  // O SINAPI publica as duas versoes; a RV usa a nao desonerada.
  const desonerado = String(form.get('desonerado') ?? 'nao') === 'sim'
  const arquivo = form.get('arquivo')

  if (!base) return { erro: 'Selecione a base.' }
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: 'Escolha o arquivo CSV.' }
  if (arquivo.size > 8 * 1024 * 1024) return { erro: 'Arquivo acima de 8 MB.' }

  const linhas = lerCSV(await arquivo.text())
  if (linhas.length === 0) return { erro: 'O arquivo não tem linhas de dados.' }

  const registros: {
    base: string
    codigo: string
    descricao: string
    unidade: string | null
    preco_unitario: number
    data_base: string | null
    uf: string
    desonerado: boolean
  }[] = []
  let ignoradas = 0

  for (const linha of linhas) {
    const codigo = coluna(linha, 'codigo', 'codigo da composicao', 'cod', 'item')
    const descricao = coluna(linha, 'descricao', 'descricao da composicao', 'servico')
    const preco = lerMoeda(
      coluna(linha, 'preco unitario', 'preco', 'custo unitario', 'valor', 'custo total'),
    )

    if (!codigo || !descricao || preco === null) {
      ignoradas++
      continue
    }

    registros.push({
      base,
      codigo,
      descricao,
      unidade: coluna(linha, 'unidade', 'und', 'un') || null,
      preco_unitario: preco,
      data_base: dataBaseForm ?? lerData(coluna(linha, 'data base', 'data_base')) ?? null,
      uf,
      desonerado,
    })
  }

  if (registros.length === 0) {
    return {
      erro:
        'Nenhuma linha aproveitável. O arquivo precisa ter as colunas de código, descrição e preço unitário.',
    }
  }

  // Grava em blocos: as tabelas publicas passam de dez mil linhas.
  const TAMANHO = 500
  for (let i = 0; i < registros.length; i += TAMANHO) {
    const { error } = await supabase
      .from('precos_referencia')
      .upsert(registros.slice(i, i + TAMANHO), {
        onConflict: 'base,codigo,data_base,uf,desonerado',
        ignoreDuplicates: false,
      })
    if (error) {
      return {
        erro: `${i} linha(s) gravadas e a importação parou: ${error.message}`,
      }
    }
  }

  revalidatePath('/cadastros/precos-referencia')
  return {
    ok:
      `${registros.length} composição(ões) importada(s) da base ${base}` +
      (ignoradas > 0 ? `; ${ignoradas} linha(s) ignorada(s) por falta de código, descrição ou preço.` : '.'),
  }
}

export async function limparBase(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const base = textoObrigatorio(form.get('base'))
  if (!base) return
  await supabase
    .from('precos_referencia')
    .update({ excluido_em: new Date().toISOString() })
    .eq('base', base)
    .is('excluido_em', null)
  revalidatePath('/cadastros/precos-referencia')
}

/**
 * Guarda um servico da propria RV, com o preco que a RV cobra.
 *
 * As tabelas publicas dizem quanto custa em media; esta diz quanto a RV cobra.
 * E a que mais se usa no dia a dia: sem ela, o mesmo "assentamento de piso
 * ceramico, m2" seria redigitado a cada orcamento, com o risco de sair um
 * preco diferente do anterior sem ninguem perceber.
 *
 * Mora na mesma tabela das referencias, com base 'proprio' — o orcamento ja
 * sabe puxar dali, e o documento do cliente nao cita 'proprio' como tabela de
 * referencia, porque nao e.
 */
export async function salvarServicoProprio(
  _e: EstadoForm | null,
  form: FormData,
): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const descricao = textoObrigatorio(form.get('descricao'))
  const unidade = textoObrigatorio(form.get('unidade'))
  const preco = lerMoeda(String(form.get('preco_unitario') ?? ''))

  if (!descricao) return { erro: 'Escreva o que é o serviço.' }
  if (!unidade) return { erro: 'Informe a unidade (m², m, un, vb...).' }
  if (preco === null || preco <= 0) return { erro: 'Informe o preço que a RV cobra.' }

  // Codigo proprio, numerado em sequencia: RV-0001, RV-0002...
  const { count } = await supabase
    .from('precos_referencia')
    .select('id', { count: 'exact', head: true })
    .eq('base', 'proprio')

  const codigoInformado = String(form.get('codigo') ?? '').trim()
  const codigo = codigoInformado || `RV-${String((count ?? 0) + 1).padStart(4, '0')}`

  const { error } = await supabase.from('precos_referencia').insert({
    base: 'proprio',
    codigo,
    descricao,
    unidade,
    preco_unitario: preco,
    data_base: hojeISO(),
    uf: 'PI',
    desonerado: false,
  })

  if (error) {
    return error.code === '23505'
      ? { erro: `Já existe um serviço com o código ${codigo} nesta data.` }
      : { erro: error.message }
  }

  revalidatePath('/cadastros/precos-referencia')
  return { ok: `Serviço guardado como ${codigo}.` }
}
