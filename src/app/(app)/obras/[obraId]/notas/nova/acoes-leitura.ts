'use server'

import { criarClienteServidor } from '@/lib/supabase/server'
import { exigirUsuario } from '@/lib/supabase/sessao'
import { lerNotaComIA, type AnexoDaNota } from '@/lib/ia/ler-nota'
import { passouDoLimiteDeLeitura } from '@/lib/ia/freio'
import {
  acharFornecedor,
  interpretarLeitura,
  resumoDaLeitura,
  type LeituraNota,
} from '@/lib/domain/leitura-nota'

export interface RespostaLeitura {
  leitura?: LeituraNota & { fornecedor_id: string | null }
  resumo?: string
  erro?: string
}

/**
 * Le a foto que ja subiu para o Storage e devolve os campos para o formulario.
 *
 * O arquivo e baixado com o cliente do proprio usuario: as policies do Storage
 * continuam valendo, e ninguem le nota de obra que nao alcanca. A IA recebe a
 * imagem, devolve os campos, e tudo passa pelo interpretarLeitura — o que nao
 * for validado vira campo vazio, nunca palpite.
 */
export async function lerFotoDaNota(entrada: {
  obraId: string
  caminhos: string[]
}): Promise<RespostaLeitura> {
  const usuario = await exigirUsuario()
  if (passouDoLimiteDeLeitura(usuario.id)) {
    return { erro: 'Muitas leituras em pouco tempo. Espere alguns minutos.' }
  }

  const caminhos = entrada.caminhos.slice(0, 4)
  if (caminhos.length === 0) return { erro: 'Anexe a foto primeiro.' }
  // A foto tem de ser desta obra: o caminho carrega a obra no primeiro nivel.
  if (caminhos.some((c) => !c.startsWith(`${entrada.obraId}/`))) {
    return { erro: 'Essa foto não é desta obra.' }
  }

  const supabase = await criarClienteServidor()
  const anexos: AnexoDaNota[] = []
  for (const caminho of caminhos) {
    const { data: arquivo, error } = await supabase.storage
      .from('notas-fiscais')
      .download(caminho)
    if (error || !arquivo) return { erro: 'Não achei a foto. Anexe de novo.' }
    anexos.push({
      bytes: new Uint8Array(await arquivo.arrayBuffer()),
      tipo: caminho.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
    })
  }

  let bruto: unknown
  try {
    bruto = await lerNotaComIA(anexos)
  } catch (e) {
    return { erro: e instanceof Error ? e.message : 'A leitura automática falhou.' }
  }

  const leitura = interpretarLeitura(bruto)

  const { data: fornecedores } = await supabase
    .from('fornecedores')
    .select('id, nome')
    .is('excluido_em', null)

  return {
    leitura: {
      ...leitura,
      fornecedor_id: acharFornecedor(leitura.fornecedor, fornecedores ?? []),
    },
    resumo: resumoDaLeitura(leitura),
  }
}
