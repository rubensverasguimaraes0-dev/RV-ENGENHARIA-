'use server'

import { criarClienteServidor } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { lerContaComIA } from '@/lib/ia/ler-conta'
import { passouDoLimiteDeLeitura } from '@/lib/ia/freio'
import type { AnexoDeLeitura } from '@/lib/ia/claude'
import {
  interpretarLeituraConta,
  resumoDaLeituraConta,
  type LeituraConta,
} from '@/lib/domain/leitura-conta'

export interface RespostaLeituraConta {
  leitura?: LeituraConta
  resumo?: string
  erro?: string
}

/**
 * Le a conta de energia que ja subiu para o Storage e devolve os campos que o
 * fluxo expresso pede digitados: consumo medio, tarifa, ligacao e UC — mais o
 * nome do titular, para cliente novo.
 *
 * O arquivo e baixado com o cliente do proprio usuario, entao as policies do
 * Storage continuam decidindo o que ele alcanca. A IA devolve os campos e tudo
 * passa pelo interpretarLeituraConta: media so de historico plausivel, tarifa
 * efetiva (total ÷ kWh) dentro da regua, e nulo onde nao deu — nunca palpite.
 */
export async function lerContaDeEnergia(entrada: {
  caminhos: string[]
}): Promise<RespostaLeituraConta> {
  // O fluxo expresso inteiro e de administrador; a leitura acompanha.
  const usuario = await exigirAdmin()
  if (passouDoLimiteDeLeitura(usuario.id)) {
    return { erro: 'Muitas leituras em pouco tempo. Espere alguns minutos.' }
  }

  const caminhos = entrada.caminhos.slice(0, 4)
  if (caminhos.length === 0) return { erro: 'Anexe a conta primeiro.' }

  const supabase = await criarClienteServidor()
  const anexos: AnexoDeLeitura[] = []
  for (const caminho of caminhos) {
    const { data: arquivo, error } = await supabase.storage.from('arquivos').download(caminho)
    if (error || !arquivo) return { erro: 'Não achei a foto da conta. Anexe de novo.' }
    anexos.push({
      bytes: new Uint8Array(await arquivo.arrayBuffer()),
      tipo: caminho.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
    })
  }

  let bruto: unknown
  try {
    bruto = await lerContaComIA(anexos)
  } catch (e) {
    return { erro: e instanceof Error ? e.message : 'A leitura automática falhou.' }
  }

  const leitura = interpretarLeituraConta(bruto)
  return { leitura, resumo: resumoDaLeituraConta(leitura) }
}
