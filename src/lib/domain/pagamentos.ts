/**
 * Cronograma de pagamentos (spec 4.9).
 *
 * Duas regras nao obvias:
 *  - parcela balao: a ultima parcela e o saldo remanescente do contrato,
 *    calculado pelo que faltar;
 *  - um recebimento pode conter valor de outro contrato. O que entra nesta obra
 *    e o recebido menos a parte de outro contrato, e a observacao sai explicita
 *    no relatorio.
 */
import type { Centavos, DataISO } from '@/lib/format'
import type { Pagamento, StatusParcela } from './tipos'

/** Valor do recebimento que pertence de fato a esta obra. */
export function valorEfetivo(p: Pick<Pagamento, 'valor_recebido' | 'valor_outro_contrato'>): Centavos {
  if (p.valor_recebido === null) return 0
  return p.valor_recebido - (p.valor_outro_contrato ?? 0)
}

export interface ResumoCronograma {
  total_previsto: Centavos
  total_recebido: Centavos
  /** Recebido descontando o que pertence a outros contratos. */
  total_recebido_nesta_obra: Centavos
  total_outro_contrato: Centavos
  saldo_contrato: Centavos
  parcelas_atrasadas: number
}

export function resumirCronograma(
  parcelas: Pagamento[],
  valorContrato: Centavos,
  hoje: DataISO,
): ResumoCronograma {
  const total_previsto = parcelas.reduce((s, p) => s + p.valor_previsto, 0)
  const total_recebido = parcelas.reduce((s, p) => s + (p.valor_recebido ?? 0), 0)
  const total_outro_contrato = parcelas.reduce((s, p) => s + (p.valor_outro_contrato ?? 0), 0)
  const total_recebido_nesta_obra = parcelas.reduce((s, p) => s + valorEfetivo(p), 0)

  return {
    total_previsto,
    total_recebido,
    total_recebido_nesta_obra,
    total_outro_contrato,
    saldo_contrato: valorContrato - total_recebido_nesta_obra,
    parcelas_atrasadas: parcelas.filter((p) => statusDaParcela(p, hoje) === 'atrasada').length,
  }
}

/** Status derivado: paga quando ha recebimento; atrasada quando venceu sem receber. */
export function statusDaParcela(
  p: Pick<Pagamento, 'valor_recebido' | 'data_prevista' | 'data_recebimento'>,
  hoje: DataISO,
): StatusParcela {
  if (p.valor_recebido !== null && p.valor_recebido > 0) return 'paga'
  if (p.data_prevista && p.data_prevista < hoje) return 'atrasada'
  return 'prevista'
}

/**
 * Valor da parcela balao: o saldo do contrato depois das demais parcelas.
 * Nunca negativo — se as parcelas ja cobrem o contrato, o balao e zero.
 */
export function calcularParcelaBalao(
  parcelas: Pick<Pagamento, 'id' | 'valor_previsto' | 'balao'>[],
  valorContrato: Centavos,
  idDoBalao: string,
): Centavos {
  const outras = parcelas
    .filter((p) => p.id !== idDoBalao)
    .reduce((s, p) => s + p.valor_previsto, 0)
  return Math.max(0, valorContrato - outras)
}
