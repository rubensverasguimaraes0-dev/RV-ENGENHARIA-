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
import { nomeDoMes, type Centavos, type DataISO } from '@/lib/format'
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
  /** fracao do contrato ja recebida: 0,298 = 29,8% quitado */
  percentual_quitado: number
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
    // Obra sem valor de contrato fechado (diaria, medicao) nao tem percentual a
    // exibir. Dividir por zero daria Infinity, e a tela mostraria "Infinity%".
    percentual_quitado: valorContrato > 0 ? total_recebido_nesta_obra / valorContrato : 0,
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

/**
 * Parcelas que geram pagina de anexo no cronograma em PDF (spec 4.9: "com os
 * comprovantes de pagamento anexados ao final do documento").
 *
 * Fica aqui, e nao na tela, para que a regra "so entra quem tem comprovante, na
 * ordem das parcelas" seja verificavel por teste.
 */
export function parcelasParaAnexar<T extends { numero_parcela: number; comprovante_assinado: string | null }>(
  parcelas: T[],
): T[] {
  return parcelas
    .filter((p) => Boolean(p.comprovante_assinado))
    .sort((a, b) => a.numero_parcela - b.numero_parcela)
}


export interface MesDoCronograma {
  /** aaaa-mm, para ordenar; vazio nas parcelas ainda sem vencimento */
  chave: string
  /** JULHO/2026 */
  rotulo: string
  parcelas: Pagamento[]
  previsto: Centavos
  recebido: Centavos
}

/**
 * Agrupa o cronograma por mes de vencimento, para o documento sair com uma
 * faixa por mes em vez de treze linhas corridas — que e como o cliente le:
 * "quanto cai em setembro".
 *
 * Parcela sem data de vencimento nao e descartada: cai num grupo proprio, no
 * fim. Sumir com uma parcela de um documento de cobranca seria pior do que
 * mostra-la sem data.
 */
export function agruparPorMes(parcelas: Pagamento[]): MesDoCronograma[] {
  const grupos = new Map<string, MesDoCronograma>()

  for (const p of parcelas) {
    const chave = p.data_prevista ? p.data_prevista.slice(0, 7) : ''
    let grupo = grupos.get(chave)
    if (!grupo) {
      grupo = {
        chave,
        rotulo: p.data_prevista ? nomeDoMes(p.data_prevista) : 'SEM VENCIMENTO DEFINIDO',
        parcelas: [],
        previsto: 0,
        recebido: 0,
      }
      grupos.set(chave, grupo)
    }
    grupo.parcelas.push(p)
    grupo.previsto += p.valor_previsto
    grupo.recebido += valorEfetivo(p)
  }

  // Ordem cronologica; o grupo sem vencimento (chave vazia) vai para o fim.
  return [...grupos.values()].sort((a, b) => {
    if (a.chave === b.chave) return 0
    if (!a.chave) return 1
    if (!b.chave) return -1
    return a.chave < b.chave ? -1 : 1
  })
}
