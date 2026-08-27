'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { booleano, moedaOuZero, numeroOuNulo, textoObrigatorio, textoOuNulo, type EstadoForm } from '@/lib/form'

export async function salvarServicoExecutado(
  _e: EstadoForm | null,
  form: FormData,
): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const obra_id = textoObrigatorio(form.get('obra_id'))
  const id = textoObrigatorio(form.get('id'))
  const descricao = textoObrigatorio(form.get('descricao'))
  if (!descricao) return { erro: 'Descreva o serviço.' }

  const executado = booleano(form.get('executado'))
  const registro = {
    obra_id,
    local_id: textoOuNulo(form.get('local_id')),
    grupo: textoOuNulo(form.get('grupo')),
    descricao,
    valor: moedaOuZero(form.get('valor')),
    executado,
    // servico nao executado deduz o valor inteiro; a deducao informada vale
    // para execucao parcial
    valor_deducao: executado ? moedaOuZero(form.get('valor_deducao')) : 0,
    justificativa_deducao: textoOuNulo(form.get('justificativa_deducao')),
    ordem: numeroOuNulo(form.get('ordem')) ?? 0,
    quantidade: numeroOuNulo(form.get('quantidade')),
    unidade: textoOuNulo(form.get('unidade')),
  }

  const { error } = id
    ? await supabase.from('servicos_executados').update(registro).eq('id', id)
    : await supabase.from('servicos_executados').insert(registro)

  if (error) return { erro: error.message }

  revalidatePath(`/obras/${obra_id}/fechamento`)
  return { ok: id ? 'Serviço atualizado.' : 'Serviço adicionado.' }
}

export async function arquivarServicoExecutado(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const obraId = textoObrigatorio(form.get('obra_id'))
  await supabase
    .from('servicos_executados')
    .update({ excluido_em: new Date().toISOString() })
    .eq('id', textoObrigatorio(form.get('id')))
  revalidatePath(`/obras/${obraId}/fechamento`)
}

/**
 * Importa como servicos do fechamento o que ja foi medido, para nao redigitar
 * o que o app ja sabe.
 */
export async function importarMedicoes(form: FormData): Promise<void> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const obraId = textoObrigatorio(form.get('obra_id'))

  const [{ data: servicosData }, { data: medicoesData }, { data: existentes }] = await Promise.all([
    supabase
      .from('servicos_medicao')
      .select('id, descricao, unidade, preco_venda_unitario')
      .eq('obra_id', obraId)
      .is('excluido_em', null),
    supabase
      .from('medicoes')
      .select('servico_id, quantidade, local_id')
      .eq('obra_id', obraId)
      .is('excluido_em', null),
    supabase
      .from('servicos_executados')
      .select('descricao')
      .eq('obra_id', obraId)
      .is('excluido_em', null),
  ])

  const jaTem = new Set(((existentes ?? []) as { descricao: string }[]).map((s) => s.descricao))
  const porServico = new Map<string, { quantidade: number; local_id: string | null }>()

  for (const m of medicoesData ?? []) {
    const chave = m.servico_id as string
    const atual = porServico.get(chave) ?? { quantidade: 0, local_id: (m.local_id as string) ?? null }
    atual.quantidade += Number(m.quantidade ?? 0)
    porServico.set(chave, atual)
  }

  const novos = (servicosData ?? [])
    .filter((s) => porServico.has(s.id as string) && !jaTem.has(s.descricao as string))
    .map((s, i) => {
      const m = porServico.get(s.id as string)!
      return {
        obra_id: obraId,
        local_id: m.local_id,
        grupo: 'Serviços medidos',
        descricao: s.descricao as string,
        valor: Math.round(m.quantidade * Number(s.preco_venda_unitario ?? 0)),
        executado: true,
        valor_deducao: 0,
        ordem: 100 + i,
        quantidade: m.quantidade,
        unidade: s.unidade as string,
      }
    })

  if (novos.length > 0) await supabase.from('servicos_executados').insert(novos)

  revalidatePath(`/obras/${obraId}/fechamento`)
}

/** Guarda o documento gerado no historico da obra, com a versao usada. */
export async function registrarDocumento(entrada: {
  obraId: string
  tipo: string
  referencia: string
  versao: Record<string, boolean>
}) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  await supabase.from('documentos').insert({
    obra_id: entrada.obraId,
    tipo: entrada.tipo,
    referencia: entrada.referencia,
    versao_exibicao_json: entrada.versao,
  })
  revalidatePath(`/obras/${entrada.obraId}/fechamento`)
}
