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
  valor_diaria: Centavos
  valor_vale: Centavos
  observacao: string | null
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
  total_mao_obra: Centavos
  total_quentinhas: Centavos
  total_vales: Centavos
  qtd_presentes: number
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
  dias_cheios: number
  dias_meios: number
  dias_sem_diaria: number
  dias_trabalhados: number
  total_diarias: Centavos
  total_vales: Centavos
  liquido: Centavos
}

export interface FechamentoSemanal {
  semana: Semana
  dias: AbaDia[]
  funcionarios: ResumoFuncionario[]
  faixas_quentinha: FaixaQuentinha[]
  total_mao_obra: Centavos
  total_quentinhas: Centavos
  qtd_quentinhas: number
  total_vales: Centavos
  total_liquido: Centavos
  /** Mao de obra + quentinhas: o custo da semana para a obra. */
  custo_semana: Centavos
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

export function calcularFechamentoSemanal(input: {
  semana: Semana
  lancamentos: LancamentoDiario[]
  quentinhas: Quentinha[]
  funcionarios: Funcionario[]
}): FechamentoSemanal {
  const { semana, lancamentos, quentinhas, funcionarios } = input
  const datas = datasDaSemana(semana)
  const dentroDaSemana = new Set(datas)
  const porId = new Map(funcionarios.map((f) => [f.id, f]))

  // Lancamentos e quentinhas de dias sem expediente (ou fora do intervalo) sao
  // descartados: o relatorio da semana encerrada na quinta nao pode conter sexta.
  const lancamentosValidos = lancamentos.filter((l) => dentroDaSemana.has(l.data))
  const quentinhasValidas = quentinhas.filter((q) => dentroDaSemana.has(q.data))

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
          valor_diaria: custoDoLancamento(l),
          valor_vale: l.valor_vale,
          observacao: l.observacao,
        }
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

    const qDia = quentinhasValidas.filter((q) => q.data === data)
    const quentinhasAgrupadas = agruparPorValorUnitario(qDia)

    const total_mao_obra = soma(linhas.map((l) => l.valor_diaria))
    const total_quentinhas = soma(quentinhasAgrupadas.map((q) => q.total))
    const total_vales = soma(linhas.map((l) => l.valor_vale))

    return {
      data,
      nome_dia: nomeDoDia(data),
      sabado: ehSabado(data),
      linhas,
      quentinhas: quentinhasAgrupadas,
      total_mao_obra,
      total_quentinhas,
      total_vales,
      qtd_presentes: linhas.length,
      qtd_quentinhas: quentinhasAgrupadas.reduce((s, q) => s + q.quantidade, 0),
      total_dia: total_mao_obra + total_quentinhas,
    }
  })

  // Somente quem teve presenca na semana entra nos resumos.
  const idsQueTrabalharam = new Set(lancamentosValidos.map((l) => l.funcionario_id))

  const resumo: ResumoFuncionario[] = [...idsQueTrabalharam]
    .map((id) => {
      const f = porId.get(id)
      const meus = lancamentosValidos.filter((l) => l.funcionario_id === id)
      const dias_cheios = meus.filter((l) => l.tipo_diaria === 'cheia').length
      const dias_meios = meus.filter((l) => l.tipo_diaria === 'meia').length
      const dias_sem_diaria = meus.filter((l) => l.tipo_diaria === 'sem_diaria').length
      const total_diarias = soma(meus.map(custoDoLancamento))
      const total_vales = soma(meus.map((l) => l.valor_vale))
      return {
        funcionario_id: id,
        nome: f?.nome ?? '(funcionario removido)',
        funcao: f?.funcao ?? '',
        tipo: f?.tipo ?? ('funcionario' as const),
        chave_pix: f?.chave_pix ?? null,
        dias_cheios,
        dias_meios,
        dias_sem_diaria,
        dias_trabalhados: meus.length,
        total_diarias,
        total_vales,
        liquido: total_diarias - total_vales,
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  const faixas = agruparPorValorUnitario(quentinhasValidas)
  const total_mao_obra = soma(resumo.map((r) => r.total_diarias))
  const total_quentinhas = soma(faixas.map((f) => f.total))
  const total_vales = soma(resumo.map((r) => r.total_vales))

  return {
    semana,
    dias,
    funcionarios: resumo,
    faixas_quentinha: faixas,
    total_mao_obra,
    total_quentinhas,
    qtd_quentinhas: faixas.reduce((s, f) => s + f.quantidade, 0),
    total_vales,
    total_liquido: soma(resumo.map((r) => r.liquido)),
    custo_semana: total_mao_obra + total_quentinhas,
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
