/**
 * O acerto da semana com a equipe.
 *
 * Sexta-feira e dia de pagamento: dez Pix, um atras do outro. O que esta
 * tabela responde e a pergunta que aparece no meio disso — "ja mandei o do
 * Iago?" — e a que aparece depois — "quanto ainda falta sair hoje?".
 *
 * O valor a receber vem do fechamento da semana e nao e digitado: quem digita
 * o valor do pagamento erra, e o erro so aparece quando o funcionario reclama.
 */
import type { Centavos, DataISO } from '@/lib/format'
import type { PagamentoFuncionario, ResumoFuncionarioSemana } from './tipos-pagamento'

export interface LinhaDoAcerto {
  funcionario_id: string
  nome: string
  funcao: string
  chave_pix: string | null
  /** o que a semana apurou para esta pessoa */
  a_receber: Centavos
  /** soma do que ja foi pago e lancado */
  pago: Centavos
  /** a_receber menos pago; negativo quando pagou a mais */
  falta: Centavos
  situacao: 'a_pagar' | 'pago' | 'parcial' | 'a_maior'
  pagamentos: PagamentoFuncionario[]
}

export function conciliarAcerto(
  funcionarios: ResumoFuncionarioSemana[],
  pagamentos: PagamentoFuncionario[],
): LinhaDoAcerto[] {
  const porFuncionario = new Map<string, PagamentoFuncionario[]>()
  for (const p of pagamentos) {
    const lista = porFuncionario.get(p.funcionario_id) ?? []
    lista.push(p)
    porFuncionario.set(p.funcionario_id, lista)
  }

  return funcionarios.map((f) => {
    const meus = (porFuncionario.get(f.funcionario_id) ?? []).sort((a, b) =>
      a.data_pagamento < b.data_pagamento ? -1 : a.data_pagamento > b.data_pagamento ? 1 : 0,
    )
    const pago = meus.reduce((s, p) => s + p.valor, 0)
    const falta = f.liquido - pago

    return {
      funcionario_id: f.funcionario_id,
      nome: f.nome,
      funcao: f.funcao,
      chave_pix: f.chave_pix,
      a_receber: f.liquido,
      pago,
      falta,
      situacao:
        falta < 0 ? 'a_maior' : falta === 0 && pago > 0 ? 'pago' : pago > 0 ? 'parcial' : 'a_pagar',
      pagamentos: meus,
    }
  })
}

export interface TotaisDoAcerto {
  a_receber: Centavos
  pago: Centavos
  falta: Centavos
  quantos_pagos: number
  quantos_faltam: number
  com_comprovante: number
}

export function totaisDoAcerto(linhas: LinhaDoAcerto[]): TotaisDoAcerto {
  return {
    a_receber: linhas.reduce((s, l) => s + l.a_receber, 0),
    pago: linhas.reduce((s, l) => s + l.pago, 0),
    // Pagou a mais para um e a menos para outro: as duas coisas nao se
    // compensam no total que ainda tem de sair da conta hoje.
    falta: linhas.reduce((s, l) => s + Math.max(0, l.falta), 0),
    quantos_pagos: linhas.filter((l) => l.situacao === 'pago' || l.situacao === 'a_maior').length,
    quantos_faltam: linhas.filter((l) => l.falta > 0).length,
    com_comprovante: linhas.filter((l) => l.pagamentos.some((p) => p.comprovante_url)).length,
  }
}

/** Data sugerida no formulario: hoje, salvo se a semana ja terminou depois. */
export function dataSugerida(hoje: DataISO, fimDaSemana: DataISO): DataISO {
  return hoje > fimDaSemana ? hoje : fimDaSemana
}
