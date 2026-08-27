/**
 * Regras do lancamento diario (spec 4.4).
 */
import type { Centavos, DataISO } from '@/lib/format'
import { aplicarFator, ehSabado } from '@/lib/format'
import type { LancamentoDiario, TipoDiaria } from './tipos'

export interface SugestaoDoDia {
  /** Sabado: a obra trabalha ate meio-dia, mas a diaria e paga integral. */
  tipo_diaria: TipoDiaria
  /** Sabado nao tem quentinha. */
  sugerir_quentinha: boolean
  motivo: string | null
}

export function sugestaoParaData(data: DataISO): SugestaoDoDia {
  if (ehSabado(data)) {
    return {
      tipo_diaria: 'cheia',
      sugerir_quentinha: false,
      motivo: 'Sabado: expediente ate meio-dia, diaria integral e sem quentinha.',
    }
  }
  return { tipo_diaria: 'cheia', sugerir_quentinha: true, motivo: null }
}

/**
 * Valor da diaria a congelar no lancamento. O valor base vem do cadastro do
 * funcionario no momento do lancamento — alterar a diaria depois vale dai para
 * frente e nao mexe no que ja foi lancado.
 */
export function valorDaDiaria(
  tipo: TipoDiaria,
  valorBase: Centavos,
  percentualMeia: number,
): Centavos {
  if (tipo === 'sem_diaria') return 0
  if (tipo === 'meia') return aplicarFator(valorBase, percentualMeia)
  return valorBase
}

/** Bloqueia dois lancamentos do mesmo funcionario, na mesma obra, na mesma data. */
export function ehLancamentoDuplicado(
  existentes: Pick<LancamentoDiario, 'id' | 'obra_id' | 'funcionario_id' | 'data'>[],
  candidato: { id?: string; obra_id: string; funcionario_id: string; data: DataISO },
): boolean {
  return existentes.some(
    (l) =>
      l.obra_id === candidato.obra_id &&
      l.funcionario_id === candidato.funcionario_id &&
      l.data === candidato.data &&
      l.id !== candidato.id,
  )
}

export const ROTULO_TIPO_DIARIA: Record<TipoDiaria, string> = {
  cheia: 'Diaria cheia',
  meia: 'Meia diaria',
  sem_diaria: 'Sem diaria',
}
