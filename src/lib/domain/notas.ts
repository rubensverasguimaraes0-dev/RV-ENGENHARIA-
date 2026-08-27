/**
 * Notas fiscais, rateio e despesas sem nota (spec 4.6, 4.7, 4.8).
 *
 * A regra central: o relatorio mostra sempre dois totais distintos — o que a
 * RV tem a repassar ao cliente e o que o cliente ja pagou direto na loja. Nota
 * paga pelo cliente entra em secao separada e nunca soma no valor a repassar.
 */
import type { Centavos } from '@/lib/format'
import type { DespesaSemNota, NotaFiscal, RateioNota } from './tipos'

export interface TotaisNotas {
  a_repassar: Centavos
  pago_pelo_cliente: Centavos
  qtd_a_repassar: number
  qtd_pago_pelo_cliente: number
}

export function totalizarNotas(notas: NotaFiscal[]): TotaisNotas {
  const rv = notas.filter((n) => n.pago_por === 'rv')
  const cli = notas.filter((n) => n.pago_por === 'cliente')
  return {
    a_repassar: rv.reduce((s, n) => s + n.valor, 0),
    pago_pelo_cliente: cli.reduce((s, n) => s + n.valor, 0),
    qtd_a_repassar: rv.length,
    qtd_pago_pelo_cliente: cli.length,
  }
}

export interface PendenciaNota {
  nota_id: string
  descricao: string
  problemas: string[]
}

/**
 * Pendencias que impedem ou alertam antes de gerar um relatorio ao cliente.
 * Nota sem foto e bloqueio duro: nenhuma nota entra em relatorio enviado sem
 * foto anexada.
 */
export function verificarPendencias(notas: NotaFiscal[]): {
  bloqueios: PendenciaNota[]
  alertas: PendenciaNota[]
} {
  const bloqueios: PendenciaNota[] = []
  const alertas: PendenciaNota[] = []

  for (const n of notas) {
    const rotulo = `${n.fornecedor_nome || 'Fornecedor nao informado'} — ${
      n.numero_nota ? `NF ${n.numero_nota}` : n.descricao || 'sem descricao'
    }`
    const duros: string[] = []
    const leves: string[] = []

    if (n.qtd_fotos <= 0) duros.push('sem foto anexada')
    if (!n.valor || n.valor <= 0) duros.push('sem valor')
    if (!n.obra_id) duros.push('sem obra vinculada')
    if (n.a_confirmar) leves.push('local a confirmar')
    if (!n.conferida) leves.push('ainda nao conferida')

    if (duros.length) bloqueios.push({ nota_id: n.id, descricao: rotulo, problemas: duros })
    if (leves.length) alertas.push({ nota_id: n.id, descricao: rotulo, problemas: leves })
  }

  return { bloqueios, alertas }
}

/**
 * Rateio de uma nota entre locais/obras. Quando nao ha rateio, o valor inteiro
 * pertence ao destino da propria nota.
 */
export function validarRateio(
  nota: Pick<NotaFiscal, 'valor'>,
  partes: Pick<RateioNota, 'valor'>[],
): { valido: boolean; somaPartes: Centavos; diferenca: Centavos } {
  const somaPartes = partes.reduce((s, p) => s + p.valor, 0)
  return {
    valido: partes.length === 0 || somaPartes === nota.valor,
    somaPartes,
    diferenca: nota.valor - somaPartes,
  }
}

export interface SubtotalPorLocal {
  local_id: string | null
  a_repassar: Centavos
  pago_pelo_cliente: Centavos
}

/**
 * Distribui as notas pelos locais da obra, aplicando o rateio quando existe.
 * E o que permite o relatorio unico com um bloco por local e subtotal por local.
 */
export function subtotaisPorLocal(
  notas: NotaFiscal[],
  rateios: RateioNota[],
  localPadraoPorNota: Map<string, string | null> = new Map(),
): SubtotalPorLocal[] {
  const mapa = new Map<string | null, SubtotalPorLocal>()
  const acumular = (local: string | null, valor: Centavos, pagoPor: NotaFiscal['pago_por']) => {
    const atual = mapa.get(local) ?? { local_id: local, a_repassar: 0, pago_pelo_cliente: 0 }
    if (pagoPor === 'rv') atual.a_repassar += valor
    else atual.pago_pelo_cliente += valor
    mapa.set(local, atual)
  }

  for (const n of notas) {
    const partes = rateios.filter((r) => r.nota_id === n.id)
    if (partes.length > 0) {
      for (const p of partes) acumular(p.local_id, p.valor, n.pago_por)
    } else {
      acumular(localPadraoPorNota.get(n.id) ?? null, n.valor, n.pago_por)
    }
  }

  return [...mapa.values()]
}

/**
 * Despesa sem nota entra no custo da obra e nunca no valor a repassar, salvo
 * marcacao explicita.
 */
export function totalDespesasSemNota(despesas: DespesaSemNota[]): {
  custo: Centavos
  a_repassar: Centavos
} {
  return {
    custo: despesas.reduce((s, d) => s + d.valor, 0),
    a_repassar: despesas.filter((d) => d.repassar_cliente).reduce((s, d) => s + d.valor, 0),
  }
}
