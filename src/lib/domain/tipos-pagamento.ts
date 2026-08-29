/**
 * Recorte dos tipos de que o acerto precisa.
 *
 * Fica separado para o calculo do acerto nao depender do fechamento semanal
 * inteiro: o que ele usa e o nome, a funcao, a chave Pix e o liquido.
 */
import type { Centavos, DataISO } from '@/lib/format'

export type { PagamentoFuncionario } from './tipos'

export interface ResumoFuncionarioSemana {
  funcionario_id: string
  nome: string
  funcao: string
  chave_pix: string | null
  liquido: Centavos
}

export type { DataISO }
