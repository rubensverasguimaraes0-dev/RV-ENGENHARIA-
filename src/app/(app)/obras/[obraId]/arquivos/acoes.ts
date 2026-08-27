'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { booleano, dataOuNulo, textoObrigatorio, textoOuNulo, type EstadoForm } from '@/lib/form'
import { hojeISO } from '@/lib/format'

/**
 * Repositorio de arquivos recebidos (spec 4.16), separado dos documentos
 * gerados pelo app: projetos, contratos, cartao CNPJ, conta de energia,
 * orcamentos de fornecedor e fotos da obra.
 */
export async function salvarArquivo(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const obra_id = textoObrigatorio(form.get('obra_id'))
  const cliente_id = textoOuNulo(form.get('cliente_id'))
  const caminhos = form.getAll('arquivo').map(String).filter(Boolean)

  if (caminhos.length === 0) return { erro: 'Escolha ao menos um arquivo.' }

  const galeria = booleano(form.get('galeria'))
  const base = {
    obra_id,
    cliente_id,
    tipo: textoObrigatorio(form.get('tipo')) || 'outro',
    descricao: textoOuNulo(form.get('descricao')),
    data: dataOuNulo(form.get('data')) ?? hojeISO(),
    galeria,
    momento: galeria ? textoOuNulo(form.get('momento')) : null,
  }

  const { error } = await supabase
    .from('arquivos')
    .insert(caminhos.map((arquivo_url) => ({ ...base, arquivo_url })))

  if (error) return { erro: error.message }

  revalidatePath(`/obras/${obra_id}/arquivos`)
  return { ok: `${caminhos.length} arquivo(s) guardado(s).` }
}

export async function arquivarArquivo(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const obraId = textoObrigatorio(form.get('obra_id'))
  await supabase
    .from('arquivos')
    .update({ excluido_em: new Date().toISOString() })
    .eq('id', textoObrigatorio(form.get('id')))
  revalidatePath(`/obras/${obraId}/arquivos`)
}

export async function alternarMomento(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const obraId = textoObrigatorio(form.get('obra_id'))
  const atual = textoOuNulo(form.get('momento'))
  const proximo = atual === 'antes' ? 'depois' : atual === 'depois' ? null : 'antes'

  await supabase
    .from('arquivos')
    .update({ momento: proximo })
    .eq('id', textoObrigatorio(form.get('id')))
  revalidatePath(`/obras/${obraId}/arquivos`)
}
