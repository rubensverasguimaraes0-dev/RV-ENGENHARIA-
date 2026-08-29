import { describe, expect, it } from 'vitest'
import { conciliarAcerto, dataSugerida, totaisDoAcerto } from './pagamento-funcionario'
import type { PagamentoFuncionario } from './tipos'
import type { ResumoFuncionarioSemana } from './tipos-pagamento'

function pessoa(id: string, nome: string, liquido: number): ResumoFuncionarioSemana {
  return { funcionario_id: id, nome, funcao: 'Servente', chave_pix: null, liquido }
}

function pago(funcionario_id: string, valor: number, extra: Partial<PagamentoFuncionario> = {}): PagamentoFuncionario {
  return {
    id: `${funcionario_id}-${valor}`, obra_id: 'o1', semana_id: 's1', funcionario_id,
    valor, data_pagamento: '2026-08-28', forma_pagamento: 'Pix',
    comprovante_url: null, observacao: null, ...extra,
  }
}

describe('acerto da semana com a equipe', () => {
  const equipe = [pessoa('f1', 'Thiago', 100000), pessoa('f2', 'Iago', 45000), pessoa('f3', 'Wiliton', 100000)]

  it('quem nao recebeu nada fica a pagar', () => {
    const l = conciliarAcerto(equipe, [])
    expect(l.map((x) => x.situacao)).toEqual(['a_pagar', 'a_pagar', 'a_pagar'])
    expect(l[0]?.falta).toBe(100000)
  })

  it('quem recebeu o valor certo fica pago', () => {
    const l = conciliarAcerto(equipe, [pago('f1', 100000)])
    expect(l[0]?.situacao).toBe('pago')
    expect(l[0]?.falta).toBe(0)
  })

  it('dois pagamentos parciais somam e fecham', () => {
    const l = conciliarAcerto(equipe, [pago('f1', 60000), pago('f1', 40000)])
    expect(l[0]?.pago).toBe(100000)
    expect(l[0]?.situacao).toBe('pago')
    expect(l[0]?.pagamentos).toHaveLength(2)
  })

  it('pagamento parcial aparece como parcial, nao como pago', () => {
    const l = conciliarAcerto(equipe, [pago('f2', 20000)])
    expect(l[1]?.situacao).toBe('parcial')
    expect(l[1]?.falta).toBe(25000)
  })

  it('pagou a mais fica marcado — nao pode passar em silencio', () => {
    const l = conciliarAcerto(equipe, [pago('f2', 50000)])
    expect(l[1]?.situacao).toBe('a_maior')
    expect(l[1]?.falta).toBe(-5000)
  })

  it('ordena os pagamentos de cada um por data', () => {
    const l = conciliarAcerto(equipe, [
      pago('f1', 40000, { data_pagamento: '2026-08-29' }),
      pago('f1', 60000, { data_pagamento: '2026-08-27' }),
    ])
    expect(l[0]?.pagamentos.map((p) => p.data_pagamento)).toEqual(['2026-08-27', '2026-08-29'])
  })

  it('pagamento de outra pessoa nao entra na linha errada', () => {
    const l = conciliarAcerto(equipe, [pago('f3', 100000)])
    expect(l[0]?.pago).toBe(0)
    expect(l[2]?.pago).toBe(100000)
  })
})

describe('totais do dia de pagamento', () => {
  const equipe = [pessoa('f1', 'Thiago', 100000), pessoa('f2', 'Iago', 45000), pessoa('f3', 'Wiliton', 100000)]

  it('soma o que falta sair da conta hoje', () => {
    const t = totaisDoAcerto(conciliarAcerto(equipe, [pago('f1', 100000), pago('f2', 20000)]))
    expect(t.a_receber).toBe(245000)
    expect(t.pago).toBe(120000)
    expect(t.falta).toBe(25000 + 100000)
    expect(t.quantos_pagos).toBe(1)
    expect(t.quantos_faltam).toBe(2)
  })

  it('pagar a mais para um nao abate o que falta para outro', () => {
    // Iago recebeu R$ 50,00 a mais; isso nao reduz o que o Wiliton tem a receber.
    const t = totaisDoAcerto(conciliarAcerto(equipe, [pago('f2', 50000)]))
    expect(t.falta).toBe(200000)
  })

  it('conta quantos ja tem comprovante anexado', () => {
    const t = totaisDoAcerto(
      conciliarAcerto(equipe, [
        pago('f1', 100000, { comprovante_url: 'o/f/1.jpg' }),
        pago('f2', 45000),
      ]),
    )
    expect(t.com_comprovante).toBe(1)
  })

  it('equipe vazia devolve zeros, sem quebrar', () => {
    const t = totaisDoAcerto([])
    expect(t).toEqual({ a_receber: 0, pago: 0, falta: 0, quantos_pagos: 0, quantos_faltam: 0, com_comprovante: 0 })
  })
})

describe('data sugerida no formulario', () => {
  it('semana ja encerrada: sugere hoje', () => {
    expect(dataSugerida('2026-08-29', '2026-08-28')).toBe('2026-08-29')
  })
  it('pagando adiantado, no meio da semana: sugere o fim da semana', () => {
    expect(dataSugerida('2026-08-26', '2026-08-29')).toBe('2026-08-29')
  })
})
