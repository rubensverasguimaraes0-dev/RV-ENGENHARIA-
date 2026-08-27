/**
 * Fechamento e relatorio de debitos (spec 4.12) — o documento que fecha a conta
 * com o cliente. Monta sozinho, a partir do que ja esta lancado.
 *
 * Saldo devedor = servicos liquidos - adiantamentos + notas a repassar
 *                 + material do almoxarifado cobrado
 */
import type { Centavos, DataISO } from '@/lib/format'

export interface ServicoExecutado {
  id: string
  obra_id: string
  local_id: string | null
  /** frente de trabalho: obras civis, eletrica, pintura, hidraulica... */
  grupo: string | null
  descricao: string
  valor: Centavos
  executado: boolean
  /** deducao parcial de um servico executado pela metade */
  valor_deducao: Centavos
  justificativa_deducao: string | null
  ordem: number
  /** opcionais, usados quando a versao mostra quantidade e preco unitario */
  quantidade?: number | null
  unidade?: string | null
}

export interface ServicoApuradoFechamento extends ServicoExecutado {
  /** o que efetivamente entra no total */
  valor_liquido: Centavos
  /** o que foi tirado do total, por nao execucao ou execucao parcial */
  deducao_efetiva: Centavos
  preco_unitario: Centavos | null
}

/**
 * Servico nao executado deduz o valor inteiro; servico executado deduz apenas
 * a parte informada (execucao parcial).
 */
export function apurarServico(s: ServicoExecutado): ServicoApuradoFechamento {
  const deducao_efetiva = s.executado ? Math.min(s.valor_deducao, s.valor) : s.valor
  return {
    ...s,
    deducao_efetiva,
    valor_liquido: s.valor - deducao_efetiva,
    preco_unitario:
      s.quantidade && s.quantidade > 0 ? Math.round(s.valor / s.quantidade) : null,
  }
}

export interface GrupoServicos {
  grupo: string
  servicos: ServicoApuradoFechamento[]
  subtotal: Centavos
  subtotal_bruto: Centavos
  deducoes: Centavos
}

export interface Adiantamento {
  id: string
  numero_parcela: number
  data_recebimento: DataISO | null
  forma_pagamento: string | null
  valor_recebido: Centavos
  /** parte do comprovante que pertence a outro contrato */
  valor_outro_contrato: Centavos
  observacao: string | null
}

export interface FechamentoDebitos {
  /** agrupado por frente de trabalho ou por local, conforme escolhido */
  grupos: GrupoServicos[]
  servicos_bruto: Centavos
  total_deducoes: Centavos
  servicos_liquidos: Centavos

  adiantamentos: Adiantamento[]
  total_adiantamentos: Centavos
  total_outro_contrato: Centavos

  notas_a_repassar: Centavos
  almoxarifado_cobrado: Centavos

  saldo_devedor: Centavos
  /** deducoes com justificativa, esclarecidas ao final do relatorio */
  esclarecimentos: { descricao: string; valor: Centavos; justificativa: string }[]
}

export type Agrupamento = 'grupo' | 'local'

export function montarFechamento(entrada: {
  servicos: ServicoExecutado[]
  adiantamentos: Adiantamento[]
  notas_a_repassar: Centavos
  almoxarifado_cobrado: Centavos
  agrupamento?: Agrupamento
  /** nome de cada local, para o titulo do grupo quando agrupado por local */
  nomeLocal?: Map<string, string>
}): FechamentoDebitos {
  const agrupamento = entrada.agrupamento ?? 'grupo'
  const apurados = entrada.servicos.map(apurarServico)

  const grupos = agrupar(apurados, agrupamento, entrada.nomeLocal ?? new Map())

  const servicos_bruto = apurados.reduce((s, x) => s + x.valor, 0)
  const total_deducoes = apurados.reduce((s, x) => s + x.deducao_efetiva, 0)
  const servicos_liquidos = servicos_bruto - total_deducoes

  const total_adiantamentos = entrada.adiantamentos.reduce(
    (s, a) => s + (a.valor_recebido - a.valor_outro_contrato),
    0,
  )
  const total_outro_contrato = entrada.adiantamentos.reduce((s, a) => s + a.valor_outro_contrato, 0)

  return {
    grupos,
    servicos_bruto,
    total_deducoes,
    servicos_liquidos,
    adiantamentos: entrada.adiantamentos,
    total_adiantamentos,
    total_outro_contrato,
    notas_a_repassar: entrada.notas_a_repassar,
    almoxarifado_cobrado: entrada.almoxarifado_cobrado,
    saldo_devedor:
      servicos_liquidos - total_adiantamentos + entrada.notas_a_repassar + entrada.almoxarifado_cobrado,
    esclarecimentos: apurados
      .filter((s) => s.deducao_efetiva > 0)
      .map((s) => ({
        descricao: s.descricao,
        valor: s.deducao_efetiva,
        justificativa:
          s.justificativa_deducao ??
          (s.executado ? 'Executado parcialmente.' : 'Item orçado e não executado.'),
      })),
  }
}

function agrupar(
  servicos: ServicoApuradoFechamento[],
  agrupamento: Agrupamento,
  nomeLocal: Map<string, string>,
): GrupoServicos[] {
  const mapa = new Map<string, ServicoApuradoFechamento[]>()

  for (const s of servicos) {
    const chave =
      agrupamento === 'local'
        ? s.local_id
          ? nomeLocal.get(s.local_id) ?? 'Local não identificado'
          : 'Obra'
        : s.grupo || 'Serviços gerais'
    mapa.set(chave, [...(mapa.get(chave) ?? []), s])
  }

  return [...mapa.entries()]
    .map(([grupo, lista]) => {
      const ordenada = [...lista].sort((a, b) => a.ordem - b.ordem)
      return {
        grupo,
        servicos: ordenada,
        subtotal: ordenada.reduce((s, x) => s + x.valor_liquido, 0),
        subtotal_bruto: ordenada.reduce((s, x) => s + x.valor, 0),
        deducoes: ordenada.reduce((s, x) => s + x.deducao_efetiva, 0),
      }
    })
    .sort((a, b) => a.grupo.localeCompare(b.grupo, 'pt-BR'))
}
