/**
 * Fechamento semanal da obra (spec 4.5).
 *
 * Regras que este modulo garante:
 *  - a semana vai de segunda a sabado, mas pode ser encerrada antes; dias sem
 *    expediente nao entram no relatorio;
 *  - so aparece quem efetivamente trabalhou na semana — quem nao teve nenhuma
 *    presenca nao entra nem nas abas de dia nem nos resumos;
 *  - meia diaria sai pela metade (percentual parametrizavel, valor editavel no
 *    lancamento — por isso o valor aplicado vem congelado no lancamento);
 *  - 'sem diaria' conta presenca e quentinha, e soma R$ 0,00 de mao de obra;
 *  - quentinhas sao separadas por faixa de valor unitario, com quantidade e
 *    custo de cada faixa;
 *  - a quantidade de quentinhas do dia nao precisa bater com o numero de
 *    presentes.
 */
import type { Centavos, DataISO } from '@/lib/format'
import { diasDaSemana, ehSabado, nomeDoDia } from '@/lib/format'
import type { Funcionario, LancamentoDiario, Quentinha, Semana, TipoDiaria } from './tipos'

export interface LinhaDia {
  funcionario_id: string
  nome: string
  funcao: string
  tipo: 'funcionario' | 'parceiro'
  tipo_diaria: TipoDiaria
  /** Diaria cheia do cadastro — a coluna "Diária (R$)" do relatorio. */
  valor_diaria_padrao: Centavos
  /** Valor efetivamente aplicado no dia (ja com a meia diaria descontada). */
  valor_diaria: Centavos
  /** 1, 0,5 ou 0 — a coluna "Presença" do relatorio. */
  fator_presenca: number
  valor_vale: Centavos
  observacao: string | null
}

/** Outro consumo do dia: gelo, taxa de entrega. Preco varia de um dia ao outro. */
export interface ExtraDia {
  descricao: string
  quantidade: number
  valor_unitario: Centavos
  total: Centavos
}

/**
 * Bonus de producao de uma pessoa num dia. Entra em mao de obra, em linha
 * separada, e NAO conta presenca: quem ja trabalhou cinco dias pode fechar a
 * semana com 5 presencas mais 2 de bonus.
 */
export interface LinhaBonus {
  funcionario_id: string
  nome: string
  descricao: string
  diarias: number
  valor: Centavos
}

export interface QuentinhaDia {
  quantidade: number
  valor_unitario: Centavos
  total: Centavos
}

export interface AbaDia {
  data: DataISO
  nome_dia: string
  sabado: boolean
  linhas: LinhaDia[]
  quentinhas: QuentinhaDia[]
  extras: ExtraDia[]
  bonus: LinhaBonus[]
  /** So as presencas do dia. */
  total_presencas: Centavos
  /** Bonus de producao pagos no dia. */
  total_bonus: Centavos
  /** Presencas + bonus — a coluna "M.O." do padrao. */
  total_mao_obra: Centavos
  total_quentinhas: Centavos
  total_extras: Centavos
  /** Quentinhas + extras — a coluna "Alimentacao e outros" do padrao. */
  total_alimentacao: Centavos
  total_vales: Centavos
  qtd_presentes: number
  /** Soma dos fatores de presenca: 1 por diaria cheia, 0,5 por meia. */
  diarias: number
  /** Diarias pagas como bonus. Nao somam com as de presenca. */
  diarias_bonus: number
  qtd_quentinhas: number
  total_dia: Centavos
}

export interface FaixaQuentinha {
  valor_unitario: Centavos
  quantidade: number
  total: Centavos
}

export interface ResumoFuncionario {
  funcionario_id: string
  nome: string
  funcao: string
  tipo: 'funcionario' | 'parceiro'
  chave_pix: string | null
  valor_diaria_padrao: Centavos
  /** dias_cheios + 0,5 x dias_meios. Dia sem diaria nao conta. */
  diarias: number
  /** Diarias recebidas como bonus de producao. */
  diarias_bonus: number
  dias_cheios: number
  dias_meios: number
  dias_sem_diaria: number
  dias_trabalhados: number
  total_diarias: Centavos
  /** Bonus de producao da semana. */
  total_bonus: Centavos
  /** Diarias + bonus — o "TOTAL A PAGAR" do relatorio. */
  total_a_pagar: Centavos
  total_vales: Centavos
  liquido: Centavos
}

export interface FechamentoSemanal {
  semana: Semana
  dias: AbaDia[]
  funcionarios: ResumoFuncionario[]
  faixas_quentinha: FaixaQuentinha[]
  /** So as presencas. */
  total_presencas: Centavos
  /** Bonus de producao da semana. */
  total_bonus: Centavos
  /** Presencas + bonus. */
  total_mao_obra: Centavos
  /** Diarias da semana: 1 por cheia, 0,5 por meia. Bonus nao entra aqui. */
  diarias: number
  diarias_bonus: number
  total_quentinhas: Centavos
  total_extras: Centavos
  /** Quentinhas + extras. */
  total_alimentacao: Centavos
  qtd_quentinhas: number
  total_vales: Centavos
  total_liquido: Centavos
  /** Mao de obra + alimentacao e outros: o custo da semana para a obra. */
  custo_semana: Centavos
  /** A semana ainda esta correndo: o relatorio sai marcado como PARCIAL. */
  parcial: boolean
}

/** Quanto o dia vale na contagem de diarias: cheia 1, meia 0,5, sem diaria 0. */
export function fatorDePresenca(tipo: TipoDiaria): number {
  if (tipo === 'cheia') return 1
  if (tipo === 'meia') return 0.5
  return 0
}

/** Custo de mao de obra de um lancamento — 'sem_diaria' nao custa nada. */
export function custoDoLancamento(l: Pick<LancamentoDiario, 'tipo_diaria' | 'valor_diaria'>): Centavos {
  return l.tipo_diaria === 'sem_diaria' ? 0 : l.valor_diaria
}

/** Datas efetivamente trabalhadas na semana: segunda a sabado menos os dias sem expediente. */
export function datasDaSemana(semana: Pick<Semana, 'data_inicio' | 'dias_sem_expediente'>): DataISO[] {
  const sem = new Set(semana.dias_sem_expediente ?? [])
  return diasDaSemana(semana.data_inicio).filter((d) => !sem.has(d))
}

export interface ExtraLancado {
  data: DataISO
  descricao: string
  quantidade: number
  valor_unitario: Centavos
}

export interface BonusLancado {
  data: DataISO
  funcionario_id: string
  descricao: string
  diarias: number
  valor: Centavos
}

export function calcularFechamentoSemanal(input: {
  semana: Semana
  lancamentos: LancamentoDiario[]
  quentinhas: Quentinha[]
  funcionarios: Funcionario[]
  extras?: ExtraLancado[]
  bonus?: BonusLancado[]
  /** Data de hoje. So serve para marcar a semana em andamento como parcial. */
  hoje?: DataISO
}): FechamentoSemanal {
  const { semana, lancamentos, quentinhas, funcionarios } = input
  const extrasEntrada = input.extras ?? []
  const bonusEntrada = input.bonus ?? []
  const datas = datasDaSemana(semana)
  const dentroDaSemana = new Set(datas)
  const porId = new Map(funcionarios.map((f) => [f.id, f]))

  // Lancamentos e quentinhas de dias sem expediente (ou fora do intervalo) sao
  // descartados: o relatorio da semana encerrada na quinta nao pode conter sexta.
  const lancamentosValidos = lancamentos.filter((l) => dentroDaSemana.has(l.data))
  const quentinhasValidas = quentinhas.filter((q) => dentroDaSemana.has(q.data))
  const extrasValidos = extrasEntrada.filter((e) => dentroDaSemana.has(e.data))
  const bonusValidos = bonusEntrada.filter((b) => dentroDaSemana.has(b.data))

  const dias: AbaDia[] = datas.map((data) => {
    const doDia = lancamentosValidos.filter((l) => l.data === data)
    const linhas: LinhaDia[] = doDia
      .map((l) => {
        const f = porId.get(l.funcionario_id)
        return {
          funcionario_id: l.funcionario_id,
          nome: f?.nome ?? '(funcionario removido)',
          funcao: f?.funcao ?? '',
          tipo: f?.tipo ?? 'funcionario',
          tipo_diaria: l.tipo_diaria,
          valor_diaria_padrao: f?.valor_diaria ?? 0,
          valor_diaria: custoDoLancamento(l),
          fator_presenca: fatorDePresenca(l.tipo_diaria),
          valor_vale: l.valor_vale,
          observacao: l.observacao,
        }
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

    const qDia = quentinhasValidas.filter((q) => q.data === data)
    const quentinhasAgrupadas = agruparPorValorUnitario(qDia)

    const extras: ExtraDia[] = extrasValidos
      .filter((e) => e.data === data)
      .map((e) => ({
        descricao: e.descricao,
        quantidade: e.quantidade,
        valor_unitario: e.valor_unitario,
        total: Math.round(e.quantidade * e.valor_unitario),
      }))

    const bonus: LinhaBonus[] = bonusValidos
      .filter((b) => b.data === data)
      .map((b) => ({
        funcionario_id: b.funcionario_id,
        nome: porId.get(b.funcionario_id)?.nome ?? '(funcionario removido)',
        descricao: b.descricao,
        diarias: b.diarias,
        valor: b.valor,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

    const total_presencas = soma(linhas.map((l) => l.valor_diaria))
    const total_bonus = soma(bonus.map((b) => b.valor))
    const total_quentinhas = soma(quentinhasAgrupadas.map((q) => q.total))
    const total_extras = soma(extras.map((e) => e.total))
    const total_vales = soma(linhas.map((l) => l.valor_vale))
    const total_mao_obra = total_presencas + total_bonus
    const total_alimentacao = total_quentinhas + total_extras

    return {
      data,
      nome_dia: nomeDoDia(data),
      sabado: ehSabado(data),
      linhas,
      quentinhas: quentinhasAgrupadas,
      extras,
      bonus,
      total_presencas,
      total_bonus,
      total_mao_obra,
      total_quentinhas,
      total_extras,
      total_alimentacao,
      total_vales,
      qtd_presentes: linhas.length,
      diarias: linhas.reduce((s, l) => s + l.fator_presenca, 0),
      diarias_bonus: bonus.reduce((s, b) => s + b.diarias, 0),
      qtd_quentinhas: quentinhasAgrupadas.reduce((s, q) => s + q.quantidade, 0),
      total_dia: total_mao_obra + total_alimentacao,
    }
  })

  // Somente quem teve presenca na semana entra nos resumos.
  const idsQueTrabalharam = new Set([
    ...lancamentosValidos.map((l) => l.funcionario_id),
    ...bonusValidos.map((b) => b.funcionario_id),
  ])

  const resumo: ResumoFuncionario[] = [...idsQueTrabalharam]
    .map((id) => {
      const f = porId.get(id)
      const meus = lancamentosValidos.filter((l) => l.funcionario_id === id)
      const dias_cheios = meus.filter((l) => l.tipo_diaria === 'cheia').length
      const dias_meios = meus.filter((l) => l.tipo_diaria === 'meia').length
      const dias_sem_diaria = meus.filter((l) => l.tipo_diaria === 'sem_diaria').length
      const total_diarias = soma(meus.map(custoDoLancamento))
      const total_vales = soma(meus.map((l) => l.valor_vale))
      const meusBonus = bonusValidos.filter((b) => b.funcionario_id === id)
      const total_bonus = soma(meusBonus.map((b) => b.valor))
      return {
        funcionario_id: id,
        nome: f?.nome ?? '(funcionario removido)',
        funcao: f?.funcao ?? '',
        tipo: f?.tipo ?? ('funcionario' as const),
        chave_pix: f?.chave_pix ?? null,
        valor_diaria_padrao: f?.valor_diaria ?? 0,
        diarias: dias_cheios + dias_meios * 0.5,
        diarias_bonus: meusBonus.reduce((s, b) => s + b.diarias, 0),
        dias_cheios,
        dias_meios,
        dias_sem_diaria,
        dias_trabalhados: meus.length,
        total_diarias,
        total_bonus,
        total_a_pagar: total_diarias + total_bonus,
        total_vales,
        liquido: total_diarias + total_bonus - total_vales,
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  const faixas = agruparPorValorUnitario(quentinhasValidas)
  const total_presencas = soma(resumo.map((r) => r.total_diarias))
  const total_bonus = soma(resumo.map((r) => r.total_bonus))
  const total_mao_obra = total_presencas + total_bonus
  const total_quentinhas = soma(faixas.map((f) => f.total))
  const total_extras = soma(dias.map((d) => d.total_extras))
  const total_alimentacao = total_quentinhas + total_extras
  const total_vales = soma(resumo.map((r) => r.total_vales))

  return {
    semana,
    dias,
    funcionarios: resumo,
    faixas_quentinha: faixas,
    total_presencas,
    total_bonus,
    total_mao_obra,
    diarias: resumo.reduce((s, r) => s + r.diarias, 0),
    diarias_bonus: resumo.reduce((s, r) => s + r.diarias_bonus, 0),
    total_quentinhas,
    total_extras,
    total_alimentacao,
    qtd_quentinhas: faixas.reduce((s, f) => s + f.quantidade, 0),
    total_vales,
    total_liquido: soma(resumo.map((r) => r.liquido)),
    custo_semana: total_mao_obra + total_alimentacao,
    // Semana que ainda nao terminou sai marcada como PARCIAL no relatorio.
    parcial: input.hoje !== undefined && semana.data_fim >= input.hoje,
  }
}

function agruparPorValorUnitario(qs: Quentinha[]): FaixaQuentinha[] {
  const mapa = new Map<Centavos, FaixaQuentinha>()
  for (const q of qs) {
    const atual = mapa.get(q.valor_unitario) ?? {
      valor_unitario: q.valor_unitario,
      quantidade: 0,
      total: 0,
    }
    atual.quantidade += q.quantidade
    atual.total += q.quantidade * q.valor_unitario
    mapa.set(q.valor_unitario, atual)
  }
  return [...mapa.values()].sort((a, b) => a.valor_unitario - b.valor_unitario)
}

function soma(valores: Centavos[]): Centavos {
  return valores.reduce((s, v) => s + v, 0)
}
