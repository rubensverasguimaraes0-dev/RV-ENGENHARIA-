import { describe, expect, it } from 'vitest'
import { conferirObra, diasEmAtraso, diasSemLancar } from './conferencia'
import type { EntradaConferencia, ParcelaParaConferir, SemanaParaConferir } from './conferencia'
import type { DataISO } from '@/lib/format'

const HOJE = '2026-09-17' as DataISO // quinta-feira

function parcela(p: Partial<ParcelaParaConferir> & { numero_parcela: number }): ParcelaParaConferir {
  return {
    valor_previsto: 500000,
    data_prevista: null,
    data_recebimento: null,
    paga: false,
    tem_comprovante: false,
    ...p,
  }
}

function semana(s: Partial<SemanaParaConferir> & { numero: number }): SemanaParaConferir {
  return {
    id: `s${s.numero}`,
    data_inicio: '2026-09-14' as DataISO,
    data_fim: '2026-09-19' as DataISO,
    fechada: false,
    dias_lancados: 5,
    tem_pagamento: true,
    ...s,
  }
}

const TUDO_EM_DIA: EntradaConferencia = {
  hoje: HOJE,
  parcelas: [parcela({ numero_parcela: 1, data_prevista: '2026-09-05' as DataISO, paga: true, tem_comprovante: true })],
  semanas: [semana({ numero: 9 })],
  custos: { materiais: 100, despesas_sem_nota: 100, locacoes: 100, entulho: 100, terceiros: 100 },
  ultimo_dia_lancado: HOJE,
}

describe('conferência da obra', () => {
  it('não acusa nada quando está tudo em dia', () => {
    const achados = conferirObra(TUDO_EM_DIA)
    expect(achados.every((a) => a.situacao === 'ok')).toBe(true)
    expect(achados).toHaveLength(4) // uma linha por área
  })

  it('soma o valor das parcelas vencidas e diz há quantos dias', () => {
    const a = conferirObra({
      ...TUDO_EM_DIA,
      parcelas: [
        parcela({ numero_parcela: 7, data_prevista: '2026-09-05' as DataISO }),
        parcela({ numero_parcela: 8, data_prevista: '2026-09-12' as DataISO }),
      ],
    }).find((x) => x.situacao === 'pendente' && x.area === 'recebimentos')!

    expect(a.titulo).toContain('R$ 10.000,00')
    expect(a.detalhe).toContain('Parcelas 7, 8')
    expect(a.detalhe).toContain('12 dias')
  })

  it('parcela paga não conta como atraso, mesmo vencida', () => {
    const p = parcela({ numero_parcela: 7, data_prevista: '2026-09-05' as DataISO, paga: true })
    expect(diasEmAtraso(p, HOJE)).toBe(0)
  })

  it('avisa da próxima parcela só dentro de uma semana', () => {
    const perto = conferirObra({
      ...TUDO_EM_DIA,
      parcelas: [parcela({ numero_parcela: 9, data_prevista: '2026-09-19' as DataISO })],
    })
    expect(perto.some((a) => a.titulo.includes('vence em 2 dias'))).toBe(true)

    const longe = conferirObra({
      ...TUDO_EM_DIA,
      parcelas: [parcela({ numero_parcela: 10, data_prevista: '2026-10-26' as DataISO })],
    })
    expect(longe.some((a) => a.titulo.includes('vence em'))).toBe(false)
  })

  it('cobra comprovante de parcela paga', () => {
    const a = conferirObra({
      ...TUDO_EM_DIA,
      parcelas: [parcela({ numero_parcela: 3, data_prevista: '2026-08-08' as DataISO, paga: true })],
    }).find((x) => x.titulo.includes('sem comprovante'))!
    expect(a.situacao).toBe('atencao')
    expect(a.detalhe).toContain('Parcela 3')
  })

  it('aponta semana que terminou e continua aberta', () => {
    const a = conferirObra({
      ...TUDO_EM_DIA,
      semanas: [semana({ numero: 8, data_inicio: '2026-09-07' as DataISO, data_fim: '2026-09-12' as DataISO })],
    }).find((x) => x.titulo.includes('por fechar'))!
    expect(a.situacao).toBe('pendente')
    expect(a.detalhe).toContain('Semana 8')
  })

  it('aponta semana fechada sem pagamento da equipe', () => {
    const a = conferirObra({
      ...TUDO_EM_DIA,
      semanas: [semana({ numero: 8, fechada: true, tem_pagamento: false, data_fim: '2026-09-12' as DataISO })],
    }).find((x) => x.area === 'equipe')!
    expect(a.situacao).toBe('pendente')
    expect(a.detalhe).toContain('Semana 8')
  })

  it('avisa que o lucro está inflado quando falta custo', () => {
    const a = conferirObra({
      ...TUDO_EM_DIA,
      custos: { materiais: 5000, despesas_sem_nota: 0, locacoes: 0, entulho: 0, terceiros: 0 },
    }).find((x) => x.area === 'custos')!
    expect(a.situacao).toBe('pendente')
    expect(a.detalhe).toContain('maior do que é')
  })

  it('domingo não conta como dia sem lançar', () => {
    // sabado 12/09 -> quinta 17/09: domingo 13 fora, sobram 4 dias uteis
    expect(diasSemLancar('2026-09-12' as DataISO, HOJE)).toBe(4)
    // lancou hoje
    expect(diasSemLancar(HOJE, HOJE)).toBe(0)
    // nunca lancou
    expect(diasSemLancar(null, HOJE)).toBe(null)
  })

  it('um dia sem lançar não vira aviso; dois viram', () => {
    const ontem = conferirObra({ ...TUDO_EM_DIA, ultimo_dia_lancado: '2026-09-16' as DataISO })
    expect(ontem.some((a) => a.titulo.includes('sem lançar'))).toBe(false)

    const antes = conferirObra({ ...TUDO_EM_DIA, ultimo_dia_lancado: '2026-09-15' as DataISO })
    expect(antes.some((a) => a.titulo.includes('sem lançar'))).toBe(true)
  })
})
