import 'server-only'
import { criarClienteServidor } from '@/lib/supabase/server'
import type { Pagamento } from '@/lib/domain/tipos'

export interface ParcelaComComprovante extends Pagamento {
  comprovante_assinado: string | null
}

/** Parcelas da obra com o comprovante ja resolvido em URL assinada. */
export async function listarParcelas(obraId: string): Promise<ParcelaComComprovante[]> {
  const supabase = await criarClienteServidor()

  const { data } = await supabase
    .from('pagamentos')
    .select(
      'id, obra_id, numero_parcela, valor_previsto, data_prevista, valor_recebido, data_recebimento, forma_pagamento, comprovante_url, valor_outro_contrato, observacao, status, balao',
    )
    .eq('obra_id', obraId)
    .is('excluido_em', null)
    .order('numero_parcela')

  const linhas = (data ?? []).map((p) => ({
    ...p,
    valor_previsto: Number(p.valor_previsto ?? 0),
    valor_recebido: p.valor_recebido === null ? null : Number(p.valor_recebido),
    valor_outro_contrato: Number(p.valor_outro_contrato ?? 0),
  })) as Pagamento[]

  const caminhos = linhas
    .map((p) => p.comprovante_url)
    .filter((c): c is string => Boolean(c) && !c!.startsWith('http'))

  const assinadas = new Map<string, string>()
  if (caminhos.length > 0) {
    const { data: urls } = await supabase.storage
      .from('comprovantes')
      .createSignedUrls([...new Set(caminhos)], 3600)
    for (const u of urls ?? []) {
      if (u.signedUrl && u.path) assinadas.set(u.path, u.signedUrl)
    }
  }

  return linhas.map((p) => ({
    ...p,
    comprovante_assinado: p.comprovante_url
      ? p.comprovante_url.startsWith('http')
        ? p.comprovante_url
        : assinadas.get(p.comprovante_url) ?? null
      : null,
  }))
}
