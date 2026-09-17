import { describe, expect, it } from 'vitest'
import { calcularFechamentoSemanal } from './fechamento-semanal'
import type { BonusLancado, ExtraLancado } from './fechamento-semanal'
import type { Funcionario, LancamentoDiario, Quentinha, Semana } from './tipos'
import type { DataISO } from '@/lib/format'

/**
 * Semanas 8 e 9 da Selecta, com os dados de referencia/dados/obra_selecta.json
 * do kit de padroes. Os totais conferidos sao os da tabela do
 * ATUALIZACAO_17-09.md: se um deles mudar, o app deixou de bater com o
 * documento do Rubens.
 *
 * Este arquivo foi gerado a partir do proprio JSON, para nao haver erro de
 * transcricao entre o documento e o teste.
 */

const funcionarios: Funcionario[] = [
  { id: 'carlos', nome: 'Carlos', tipo: 'funcionario', funcao: '', valor_diaria: 10000,
    telefone: null, chave_pix: null, status: 'ativo', data_entrada: null, data_saida: null },
  { id: 'francisco', nome: 'Francisco', tipo: 'funcionario', funcao: '', valor_diaria: 16000,
    telefone: null, chave_pix: null, status: 'ativo', data_entrada: null, data_saida: null },
  { id: 'rufino', nome: 'Rufino', tipo: 'funcionario', funcao: '', valor_diaria: 10000,
    telefone: null, chave_pix: null, status: 'ativo', data_entrada: null, data_saida: null },
  { id: 'thiago', nome: 'Thiago', tipo: 'funcionario', funcao: '', valor_diaria: 20000,
    telefone: null, chave_pix: null, status: 'ativo', data_entrada: null, data_saida: null },
  { id: 'wiliton', nome: 'Wiliton', tipo: 'funcionario', funcao: '', valor_diaria: 20000,
    telefone: null, chave_pix: null, status: 'ativo', data_entrada: null, data_saida: null },
]

const semana8: Semana = {
  id: 's8', obra_id: 'o1', numero: 8, data_inicio: '2026-09-07' as DataISO,
  data_fim: '2026-09-12' as DataISO, dias_sem_expediente: [], status: 'fechada',
}

const lancamentos8: LancamentoDiario[] = [
  { id: 'l8-1', obra_id: 'o1', semana_id: 's8', funcionario_id: 'thiago',
    data: '2026-09-07' as DataISO, tipo_diaria: 'cheia', valor_diaria: 20000, valor_vale: 0, observacao: null },
  { id: 'l8-2', obra_id: 'o1', semana_id: 's8', funcionario_id: 'thiago',
    data: '2026-09-08' as DataISO, tipo_diaria: 'cheia', valor_diaria: 20000, valor_vale: 0, observacao: null },
  { id: 'l8-3', obra_id: 'o1', semana_id: 's8', funcionario_id: 'francisco',
    data: '2026-09-08' as DataISO, tipo_diaria: 'cheia', valor_diaria: 16000, valor_vale: 0, observacao: null },
  { id: 'l8-4', obra_id: 'o1', semana_id: 's8', funcionario_id: 'rufino',
    data: '2026-09-08' as DataISO, tipo_diaria: 'cheia', valor_diaria: 10000, valor_vale: 0, observacao: null },
  { id: 'l8-5', obra_id: 'o1', semana_id: 's8', funcionario_id: 'carlos',
    data: '2026-09-08' as DataISO, tipo_diaria: 'cheia', valor_diaria: 10000, valor_vale: 0, observacao: null },
  { id: 'l8-6', obra_id: 'o1', semana_id: 's8', funcionario_id: 'thiago',
    data: '2026-09-09' as DataISO, tipo_diaria: 'cheia', valor_diaria: 20000, valor_vale: 0, observacao: null },
  { id: 'l8-7', obra_id: 'o1', semana_id: 's8', funcionario_id: 'francisco',
    data: '2026-09-09' as DataISO, tipo_diaria: 'cheia', valor_diaria: 16000, valor_vale: 0, observacao: null },
  { id: 'l8-8', obra_id: 'o1', semana_id: 's8', funcionario_id: 'rufino',
    data: '2026-09-09' as DataISO, tipo_diaria: 'cheia', valor_diaria: 10000, valor_vale: 0, observacao: null },
  { id: 'l8-9', obra_id: 'o1', semana_id: 's8', funcionario_id: 'carlos',
    data: '2026-09-09' as DataISO, tipo_diaria: 'cheia', valor_diaria: 10000, valor_vale: 0, observacao: null },
  { id: 'l8-10', obra_id: 'o1', semana_id: 's8', funcionario_id: 'thiago',
    data: '2026-09-10' as DataISO, tipo_diaria: 'cheia', valor_diaria: 20000, valor_vale: 0, observacao: null },
  { id: 'l8-11', obra_id: 'o1', semana_id: 's8', funcionario_id: 'francisco',
    data: '2026-09-10' as DataISO, tipo_diaria: 'cheia', valor_diaria: 16000, valor_vale: 0, observacao: null },
  { id: 'l8-12', obra_id: 'o1', semana_id: 's8', funcionario_id: 'rufino',
    data: '2026-09-10' as DataISO, tipo_diaria: 'cheia', valor_diaria: 10000, valor_vale: 0, observacao: null },
  { id: 'l8-13', obra_id: 'o1', semana_id: 's8', funcionario_id: 'carlos',
    data: '2026-09-10' as DataISO, tipo_diaria: 'cheia', valor_diaria: 10000, valor_vale: 0, observacao: null },
  { id: 'l8-14', obra_id: 'o1', semana_id: 's8', funcionario_id: 'thiago',
    data: '2026-09-11' as DataISO, tipo_diaria: 'cheia', valor_diaria: 20000, valor_vale: 0, observacao: null },
  { id: 'l8-15', obra_id: 'o1', semana_id: 's8', funcionario_id: 'francisco',
    data: '2026-09-11' as DataISO, tipo_diaria: 'cheia', valor_diaria: 16000, valor_vale: 0, observacao: null },
  { id: 'l8-16', obra_id: 'o1', semana_id: 's8', funcionario_id: 'rufino',
    data: '2026-09-11' as DataISO, tipo_diaria: 'cheia', valor_diaria: 10000, valor_vale: 0, observacao: null },
  { id: 'l8-17', obra_id: 'o1', semana_id: 's8', funcionario_id: 'carlos',
    data: '2026-09-11' as DataISO, tipo_diaria: 'cheia', valor_diaria: 10000, valor_vale: 0, observacao: null },
]

const quentinhas8: Quentinha[] = [
  { id: 'q8-1', obra_id: 'o1', semana_id: 's8', data: '2026-09-08' as DataISO,
    quantidade: 4, valor_unitario: 1800 },
  { id: 'q8-2', obra_id: 'o1', semana_id: 's8', data: '2026-09-09' as DataISO,
    quantidade: 4, valor_unitario: 1800 },
  { id: 'q8-3', obra_id: 'o1', semana_id: 's8', data: '2026-09-10' as DataISO,
    quantidade: 4, valor_unitario: 1800 },
  { id: 'q8-4', obra_id: 'o1', semana_id: 's8', data: '2026-09-11' as DataISO,
    quantidade: 4, valor_unitario: 1800 },
]

const extras8: ExtraLancado[] = [
  { data: '2026-09-08' as DataISO, descricao: 'Gelo', quantidade: 2, valor_unitario: 600 },
  { data: '2026-09-09' as DataISO, descricao: 'Gelo', quantidade: 2, valor_unitario: 600 },
  { data: '2026-09-10' as DataISO, descricao: 'Gelo', quantidade: 2, valor_unitario: 600 },
  { data: '2026-09-10' as DataISO, descricao: 'Entrega de quentinhas', quantidade: 1, valor_unitario: 1000 },
  { data: '2026-09-11' as DataISO, descricao: 'Gelo', quantidade: 2, valor_unitario: 600 },
  { data: '2026-09-11' as DataISO, descricao: 'Entrega de quentinhas', quantidade: 1, valor_unitario: 1000 },
]

const bonus8: BonusLancado[] = [
]

const semana9: Semana = {
  id: 's9', obra_id: 'o1', numero: 9, data_inicio: '2026-09-14' as DataISO,
  data_fim: '2026-09-19' as DataISO, dias_sem_expediente: [], status: 'fechada',
}

const lancamentos9: LancamentoDiario[] = [
  { id: 'l9-1', obra_id: 'o1', semana_id: 's9', funcionario_id: 'thiago',
    data: '2026-09-14' as DataISO, tipo_diaria: 'cheia', valor_diaria: 20000, valor_vale: 0, observacao: null },
  { id: 'l9-2', obra_id: 'o1', semana_id: 's9', funcionario_id: 'francisco',
    data: '2026-09-14' as DataISO, tipo_diaria: 'cheia', valor_diaria: 16000, valor_vale: 0, observacao: null },
  { id: 'l9-3', obra_id: 'o1', semana_id: 's9', funcionario_id: 'rufino',
    data: '2026-09-14' as DataISO, tipo_diaria: 'cheia', valor_diaria: 10000, valor_vale: 0, observacao: null },
  { id: 'l9-4', obra_id: 'o1', semana_id: 's9', funcionario_id: 'carlos',
    data: '2026-09-14' as DataISO, tipo_diaria: 'cheia', valor_diaria: 10000, valor_vale: 0, observacao: null },
  { id: 'l9-5', obra_id: 'o1', semana_id: 's9', funcionario_id: 'thiago',
    data: '2026-09-15' as DataISO, tipo_diaria: 'cheia', valor_diaria: 20000, valor_vale: 0, observacao: null },
  { id: 'l9-6', obra_id: 'o1', semana_id: 's9', funcionario_id: 'francisco',
    data: '2026-09-15' as DataISO, tipo_diaria: 'cheia', valor_diaria: 16000, valor_vale: 0, observacao: null },
  { id: 'l9-7', obra_id: 'o1', semana_id: 's9', funcionario_id: 'rufino',
    data: '2026-09-15' as DataISO, tipo_diaria: 'cheia', valor_diaria: 10000, valor_vale: 0, observacao: null },
  { id: 'l9-8', obra_id: 'o1', semana_id: 's9', funcionario_id: 'carlos',
    data: '2026-09-15' as DataISO, tipo_diaria: 'cheia', valor_diaria: 10000, valor_vale: 0, observacao: null },
  { id: 'l9-9', obra_id: 'o1', semana_id: 's9', funcionario_id: 'wiliton',
    data: '2026-09-15' as DataISO, tipo_diaria: 'cheia', valor_diaria: 20000, valor_vale: 0, observacao: null },
  { id: 'l9-10', obra_id: 'o1', semana_id: 's9', funcionario_id: 'thiago',
    data: '2026-09-16' as DataISO, tipo_diaria: 'cheia', valor_diaria: 20000, valor_vale: 0, observacao: null },
  { id: 'l9-11', obra_id: 'o1', semana_id: 's9', funcionario_id: 'francisco',
    data: '2026-09-16' as DataISO, tipo_diaria: 'cheia', valor_diaria: 16000, valor_vale: 0, observacao: null },
  { id: 'l9-12', obra_id: 'o1', semana_id: 's9', funcionario_id: 'rufino',
    data: '2026-09-16' as DataISO, tipo_diaria: 'cheia', valor_diaria: 10000, valor_vale: 0, observacao: null },
  { id: 'l9-13', obra_id: 'o1', semana_id: 's9', funcionario_id: 'carlos',
    data: '2026-09-16' as DataISO, tipo_diaria: 'cheia', valor_diaria: 10000, valor_vale: 0, observacao: null },
  { id: 'l9-14', obra_id: 'o1', semana_id: 's9', funcionario_id: 'wiliton',
    data: '2026-09-16' as DataISO, tipo_diaria: 'cheia', valor_diaria: 20000, valor_vale: 0, observacao: null },
  { id: 'l9-15', obra_id: 'o1', semana_id: 's9', funcionario_id: 'thiago',
    data: '2026-09-17' as DataISO, tipo_diaria: 'cheia', valor_diaria: 20000, valor_vale: 0, observacao: null },
  { id: 'l9-16', obra_id: 'o1', semana_id: 's9', funcionario_id: 'francisco',
    data: '2026-09-17' as DataISO, tipo_diaria: 'cheia', valor_diaria: 16000, valor_vale: 0, observacao: null },
  { id: 'l9-17', obra_id: 'o1', semana_id: 's9', funcionario_id: 'rufino',
    data: '2026-09-17' as DataISO, tipo_diaria: 'cheia', valor_diaria: 10000, valor_vale: 0, observacao: null },
  { id: 'l9-18', obra_id: 'o1', semana_id: 's9', funcionario_id: 'carlos',
    data: '2026-09-17' as DataISO, tipo_diaria: 'cheia', valor_diaria: 10000, valor_vale: 0, observacao: null },
  { id: 'l9-19', obra_id: 'o1', semana_id: 's9', funcionario_id: 'wiliton',
    data: '2026-09-17' as DataISO, tipo_diaria: 'cheia', valor_diaria: 20000, valor_vale: 0, observacao: null },
]

const quentinhas9: Quentinha[] = [
  { id: 'q9-1', obra_id: 'o1', semana_id: 's9', data: '2026-09-14' as DataISO,
    quantidade: 4, valor_unitario: 1800 },
  { id: 'q9-2', obra_id: 'o1', semana_id: 's9', data: '2026-09-15' as DataISO,
    quantidade: 5, valor_unitario: 1800 },
  { id: 'q9-3', obra_id: 'o1', semana_id: 's9', data: '2026-09-16' as DataISO,
    quantidade: 5, valor_unitario: 1800 },
  { id: 'q9-4', obra_id: 'o1', semana_id: 's9', data: '2026-09-17' as DataISO,
    quantidade: 5, valor_unitario: 1800 },
]

const extras9: ExtraLancado[] = [
  { data: '2026-09-14' as DataISO, descricao: 'Gelo', quantidade: 1, valor_unitario: 500 },
  { data: '2026-09-15' as DataISO, descricao: 'Gelo', quantidade: 1, valor_unitario: 700 },
  { data: '2026-09-16' as DataISO, descricao: 'Gelo', quantidade: 1, valor_unitario: 700 },
  { data: '2026-09-17' as DataISO, descricao: 'Gelo', quantidade: 1, valor_unitario: 500 },
]

const bonus9: BonusLancado[] = [
  { data: '2026-09-16' as DataISO, funcionario_id: 'thiago',
    descricao: 'Bônus de produção — revestimento 110 m² ...', diarias: 2, valor: 40000 },
  { data: '2026-09-16' as DataISO, funcionario_id: 'francisco',
    descricao: 'Bônus de produção — revestimento 110 m² ...', diarias: 2, valor: 32000 },
  { data: '2026-09-16' as DataISO, funcionario_id: 'rufino',
    descricao: 'Bônus de produção — revestimento 110 m² ...', diarias: 2, valor: 20000 },
  { data: '2026-09-16' as DataISO, funcionario_id: 'carlos',
    descricao: 'Bônus de produção — revestimento 110 m² ...', diarias: 2, valor: 20000 },
]

const f8 = calcularFechamentoSemanal({
  semana: semana8, lancamentos: lancamentos8, quentinhas: quentinhas8,
  funcionarios, extras: extras8, bonus: bonus8, hoje: '2026-09-17' as DataISO,
})

const f9 = calcularFechamentoSemanal({
  semana: { ...semana9, status: 'aberta' }, lancamentos: lancamentos9, quentinhas: quentinhas9,
  funcionarios, extras: extras9, bonus: bonus9, hoje: '2026-09-17' as DataISO,
})

describe('semana 8 — extras entram na alimentação', () => {
  it('fecha nos números do documento', () => {
    expect(f8.diarias).toBe(17)
    expect(f8.total_mao_obra).toBe(244000)      // R$ 2.440,00
    expect(f8.qtd_quentinhas).toBe(16)
    expect(f8.total_quentinhas).toBe(28800)     // R$ 288,00
    expect(f8.total_extras).toBe(6800)          // gelo R$ 48,00 + entrega R$ 20,00
    expect(f8.total_alimentacao).toBe(35600)    // R$ 356,00
    expect(f8.custo_semana).toBe(279600)        // R$ 2.796,00
  })

  it('o feriado com expediente até meio-dia sai com diária cheia e sem quentinha', () => {
    const feriado = f8.dias.find((d) => d.data === '2026-09-07')!
    expect(feriado.diarias).toBe(1)
    expect(feriado.total_presencas).toBe(20000)
    expect(feriado.qtd_quentinhas).toBe(0)
    expect(feriado.total_dia).toBe(20000)
  })

  it('o gelo aparece com a quantidade e o preço do próprio dia', () => {
    const dia = f8.dias.find((d) => d.data === '2026-09-08')!
    expect(dia.extras).toHaveLength(1)
    expect(dia.extras[0]!.descricao).toBe('Gelo')
    expect(dia.extras[0]!.quantidade).toBe(2)
    expect(dia.extras[0]!.valor_unitario).toBe(600)
    expect(dia.extras[0]!.total).toBe(1200)
  })

  it('semana encerrada não sai como parcial', () => {
    expect(f8.parcial).toBe(false)
  })
})

describe('semana 9 — bônus de produção', () => {
  it('fecha nos números do documento', () => {
    expect(f9.diarias).toBe(19)
    expect(f9.diarias_bonus).toBe(8)
    expect(f9.total_presencas).toBe(284000)     // R$ 2.840,00
    expect(f9.total_bonus).toBe(112000)         // R$ 1.120,00
    expect(f9.total_mao_obra).toBe(396000)      // R$ 3.960,00
    expect(f9.qtd_quentinhas).toBe(19)
    expect(f9.total_alimentacao).toBe(36600)    // R$ 366,00
    expect(f9.custo_semana).toBe(432600)        // R$ 4.326,00
  })

  it('o bônus não conta como presença', () => {
    const quarta = f9.dias.find((d) => d.data === '2026-09-16')!
    expect(quarta.diarias).toBe(5)              // cinco presentes
    expect(quarta.diarias_bonus).toBe(8)        // quatro pessoas x 2 diárias
    expect(quarta.bonus).toHaveLength(4)
  })

  it('cada pessoa do acordo fecha com presença mais bônus', () => {
    const thiago = f9.funcionarios.find((r) => r.nome === 'Thiago')!
    expect(thiago.diarias).toBe(4)
    expect(thiago.diarias_bonus).toBe(2)
    expect(thiago.total_diarias).toBe(80000)    // 4 x R$ 200,00
    expect(thiago.total_bonus).toBe(40000)      // 2 x R$ 200,00
    expect(thiago.total_a_pagar).toBe(120000)   // R$ 1.200,00
  })

  it('quem não entrou no acordo fica só com a presença', () => {
    const wiliton = f9.funcionarios.find((r) => r.nome === 'Wiliton')!
    expect(wiliton.diarias).toBe(3)
    expect(wiliton.total_bonus).toBe(0)
    expect(wiliton.total_a_pagar).toBe(60000)   // R$ 600,00
  })

  it('semana em andamento sai marcada como parcial', () => {
    expect(f9.parcial).toBe(true)
  })
})
