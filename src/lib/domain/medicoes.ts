/**
 * Medicoes e servicos de terceiros (spec 4.11) — o que nao e pago por diaria.
 *
 * Medicao e servico por producao: o cliente paga pelo que foi executado, em m2,
 * metro linear ou unidade. O custo unitario (material + mao de obra) existe
 * apenas na apuracao interna: no documento do cliente sai o preco de venda.
 */
import type { Centavos, DataISO } from '@/lib/format'

export type UnidadeMedicao = 'm2' | 'm' | 'un' | 'vb'

export const ROTULO_UNIDADE: Record<UnidadeMedicao, string> = {
  m2: 'm²',
  m: 'm linear',
  un: 'unidade',
  vb: 'verba',
}

export interface ServicoMedicao {
  id: string
  obra_id: string
  descricao: string
  unidade: UnidadeMedicao | string
  quantidade_contratada: number | null
  /** interno: material + mao de obra */
  custo_unitario: Centavos | null
  preco_venda_unitario: Centavos
}

export interface Medicao {
  id: string
  obra_id: string
  servico_id: string
  local_id: string | null
  data: DataISO
  quantidade: number
  observacao: string | null
}

export interface ServicoApurado extends ServicoMedicao {
  quantidade_executada: number
  /** quantidade contratada - executada; null quando nao ha contratada */
  saldo_a_executar: number | null
  /** fracao executada do contratado (1 = 100%) */
  percentual_executado: number | null
  valor_executado: Centavos
  valor_contratado: Centavos | null
  /** interno */
  custo_executado: Centavos
  margem: Centavos
  margem_percentual: number
}

export function apurarServicos(
  servicos: ServicoMedicao[],
  medicoes: Medicao[],
): ServicoApurado[] {
  return servicos.map((s) => {
    const minhas = medicoes.filter((m) => m.servico_id === s.id)
    const quantidade_executada = arredondar(minhas.reduce((acc, m) => acc + m.quantidade, 0))

    const valor_executado = Math.round(quantidade_executada * s.preco_venda_unitario)
    const custo_executado = Math.round(quantidade_executada * (s.custo_unitario ?? 0))

    return {
      ...s,
      quantidade_executada,
      saldo_a_executar:
        s.quantidade_contratada === null
          ? null
          : arredondar(s.quantidade_contratada - quantidade_executada),
      percentual_executado:
        s.quantidade_contratada && s.quantidade_contratada > 0
          ? quantidade_executada / s.quantidade_contratada
          : null,
      valor_executado,
      valor_contratado:
        s.quantidade_contratada === null
          ? null
          : Math.round(s.quantidade_contratada * s.preco_venda_unitario),
      custo_executado,
      margem: valor_executado - custo_executado,
      margem_percentual: valor_executado > 0 ? (valor_executado - custo_executado) / valor_executado : 0,
    }
  })
}

export interface TotaisMedicao {
  valor_executado: Centavos
  valor_contratado: Centavos
  custo_executado: Centavos
  margem: Centavos
}

export function totalizarMedicoes(servicos: ServicoApurado[]): TotaisMedicao {
  const valor_executado = servicos.reduce((s, x) => s + x.valor_executado, 0)
  const custo_executado = servicos.reduce((s, x) => s + x.custo_executado, 0)
  return {
    valor_executado,
    valor_contratado: servicos.reduce((s, x) => s + (x.valor_contratado ?? x.valor_executado), 0),
    custo_executado,
    margem: valor_executado - custo_executado,
  }
}

/** Medicoes agrupadas por local, para o relatorio com um bloco por local. */
export function medicoesPorLocal(
  servicos: ServicoApurado[],
  medicoes: Medicao[],
): { local_id: string | null; valor: Centavos }[] {
  const precoPorServico = new Map(servicos.map((s) => [s.id, s.preco_venda_unitario]))
  const mapa = new Map<string | null, Centavos>()

  for (const m of medicoes) {
    const preco = precoPorServico.get(m.servico_id) ?? 0
    const atual = mapa.get(m.local_id) ?? 0
    mapa.set(m.local_id, atual + Math.round(m.quantidade * preco))
  }

  return [...mapa.entries()].map(([local_id, valor]) => ({ local_id, valor }))
}

// ---------------------------------------------------------------------------
// Terceiros / subempreiteiros
// ---------------------------------------------------------------------------

export interface ServicoTerceiro {
  id: string
  obra_id: string
  terceiro_id: string
  descricao: string | null
  quantidade: number | null
  valor_combinado: Centavos
  valor_pago: Centavos
  comprovante_url: string | null
}

export interface TerceiroApurado extends ServicoTerceiro {
  saldo: Centavos
  quitado: boolean
}

export function apurarTerceiros(servicos: ServicoTerceiro[]): TerceiroApurado[] {
  return servicos.map((s) => ({
    ...s,
    saldo: s.valor_combinado - s.valor_pago,
    quitado: s.valor_pago >= s.valor_combinado && s.valor_combinado > 0,
  }))
}

export function totalizarTerceiros(servicos: TerceiroApurado[]): {
  combinado: Centavos
  pago: Centavos
  saldo: Centavos
} {
  return {
    combinado: servicos.reduce((s, x) => s + x.valor_combinado, 0),
    pago: servicos.reduce((s, x) => s + x.valor_pago, 0),
    saldo: servicos.reduce((s, x) => s + x.saldo, 0),
  }
}

function arredondar(v: number): number {
  return Math.round(v * 10000) / 10000
}
