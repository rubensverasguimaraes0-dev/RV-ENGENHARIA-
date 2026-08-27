/**
 * Locacao de equipamentos (spec 7) — braco novo da empresa.
 *
 * A regra que exige cuidado e a da devolucao: o contrato e fechado por um
 * periodo previsto, e o equipamento devolvido depois disso gera diarias
 * adicionais. A cobranca usa a tabela por diaria, semana e mes, escolhendo
 * sempre a combinacao mais barata para o cliente — que e como o mercado cobra.
 */
import type { Centavos, DataISO } from '@/lib/format'
import { diferencaEmDias } from '@/lib/format'

export type StatusEquipamento = 'disponivel' | 'locado' | 'manutencao'
export type StatusContrato = 'aberto' | 'devolvido' | 'atrasado' | 'cancelado'

export interface TabelaPreco {
  valor_diaria: Centavos
  valor_semana: Centavos
  valor_mes: Centavos
}

export interface CobrancaPeriodo {
  dias: number
  meses: number
  semanas: number
  diarias: number
  valor: Centavos
  /** como o valor foi montado, para sair explicado no contrato */
  detalhe: string
}

/**
 * Valor de um periodo pela tabela, combinando mes, semana e diaria.
 *
 * Cobra por mes enquanto compensar, depois por semana, depois por diaria — e
 * ao final compara com a alternativa de arredondar para cima no proximo bloco,
 * ficando com o que sair mais barato. Um equipamento devolvido no 29o dia nao
 * pode custar mais que um devolvido no 30o.
 */
export function calcularPeriodo(dias: number, tabela: TabelaPreco): CobrancaPeriodo {
  const diasCobrados = Math.max(1, Math.ceil(dias))

  const temMes = tabela.valor_mes > 0
  const temSemana = tabela.valor_semana > 0
  const diaria = tabela.valor_diaria

  let restante = diasCobrados
  let meses = 0
  let semanas = 0

  if (temMes) {
    meses = Math.floor(restante / 30)
    restante -= meses * 30
  }
  if (temSemana) {
    semanas = Math.floor(restante / 7)
    restante -= semanas * 7
  }
  const diarias = restante

  const valorComposto =
    meses * tabela.valor_mes + semanas * tabela.valor_semana + diarias * diaria

  // Alternativas de arredondar para cima: nunca cobrar mais que o bloco seguinte
  const alternativas: { valor: Centavos; detalhe: string }[] = [
    {
      valor: valorComposto,
      detalhe: montarDetalhe(meses, semanas, diarias),
    },
  ]

  if (temSemana && diarias > 0) {
    const v = meses * tabela.valor_mes + (semanas + 1) * tabela.valor_semana
    alternativas.push({ valor: v, detalhe: montarDetalhe(meses, semanas + 1, 0) })
  }
  if (temMes && (semanas > 0 || diarias > 0)) {
    const v = (meses + 1) * tabela.valor_mes
    alternativas.push({ valor: v, detalhe: montarDetalhe(meses + 1, 0, 0) })
  }

  const escolhida = alternativas.reduce((a, b) => (a.valor <= b.valor ? a : b))

  return {
    dias: diasCobrados,
    meses,
    semanas,
    diarias,
    valor: escolhida.valor,
    detalhe: escolhida.detalhe,
  }
}

function montarDetalhe(meses: number, semanas: number, diarias: number): string {
  const partes: string[] = []
  if (meses > 0) partes.push(`${meses} ${meses === 1 ? 'mês' : 'meses'}`)
  if (semanas > 0) partes.push(`${semanas} ${semanas === 1 ? 'semana' : 'semanas'}`)
  if (diarias > 0) partes.push(`${diarias} ${diarias === 1 ? 'diária' : 'diárias'}`)
  return partes.join(' + ') || '1 diária'
}

export interface ItemContrato {
  id: string
  equipamento_id: string
  descricao: string
  quantidade: number
  tabela: TabelaPreco
}

export interface ApuracaoContrato {
  dias_previstos: number
  dias_efetivos: number
  dias_adicionais: number
  valor_previsto: Centavos
  valor_adicional: Centavos
  valor_total: Centavos
  detalhe_previsto: string
  detalhe_adicional: string
  em_atraso: boolean
  itens: {
    item: ItemContrato
    valor_previsto: Centavos
    valor_adicional: Centavos
    valor_total: Centavos
  }[]
}

/**
 * Apura o contrato: o previsto pelo periodo combinado e o adicional pelos dias
 * que passaram da devolucao prevista.
 *
 * `ate` e a data de devolucao efetiva; sem ela, usa-se hoje — e o que faz o
 * alerta de equipamento nao devolvido mostrar quanto ja esta correndo.
 */
export function apurarContrato(entrada: {
  itens: ItemContrato[]
  data_saida: DataISO
  data_prevista: DataISO | null
  data_devolucao: DataISO | null
  hoje: DataISO
}): ApuracaoContrato {
  const { itens, data_saida, data_prevista, data_devolucao, hoje } = entrada

  const fim = data_devolucao ?? hoje
  const dias_efetivos = Math.max(1, diferencaEmDias(data_saida, fim))
  const dias_previstos = data_prevista
    ? Math.max(1, diferencaEmDias(data_saida, data_prevista))
    : dias_efetivos
  const dias_adicionais = Math.max(0, dias_efetivos - dias_previstos)

  const detalhes = itens.map((item) => {
    const previsto = calcularPeriodo(dias_previstos, item.tabela)
    const adicional =
      dias_adicionais > 0
        ? calcularPeriodo(dias_adicionais, item.tabela)
        : { valor: 0, detalhe: '' }

    return {
      item,
      valor_previsto: previsto.valor * item.quantidade,
      valor_adicional: adicional.valor * item.quantidade,
      valor_total: (previsto.valor + adicional.valor) * item.quantidade,
      detalhe_previsto: previsto.detalhe,
      detalhe_adicional: adicional.detalhe,
    }
  })

  const valor_previsto = detalhes.reduce((s, d) => s + d.valor_previsto, 0)
  const valor_adicional = detalhes.reduce((s, d) => s + d.valor_adicional, 0)

  return {
    dias_previstos,
    dias_efetivos,
    dias_adicionais,
    valor_previsto,
    valor_adicional,
    valor_total: valor_previsto + valor_adicional,
    detalhe_previsto: detalhes[0]?.detalhe_previsto ?? '',
    detalhe_adicional: detalhes[0]?.detalhe_adicional ?? '',
    em_atraso: data_devolucao === null && data_prevista !== null && data_prevista < hoje,
    itens: detalhes.map(({ item, valor_previsto: p, valor_adicional: a, valor_total: t }) => ({
      item,
      valor_previsto: p,
      valor_adicional: a,
      valor_total: t,
    })),
  }
}

/** Status derivado do contrato, para a listagem e os alertas. */
export function statusDoContrato(
  contrato: { data_prevista: DataISO | null; data_devolucao: DataISO | null; status: StatusContrato },
  hoje: DataISO,
): StatusContrato {
  if (contrato.status === 'cancelado') return 'cancelado'
  if (contrato.data_devolucao) return 'devolvido'
  if (contrato.data_prevista && contrato.data_prevista < hoje) return 'atrasado'
  return 'aberto'
}

/** Saldo a receber: total apurado menos a caucao ja retida. */
export function saldoDoContrato(total: Centavos, caucao: Centavos): Centavos {
  return Math.max(0, total - caucao)
}
