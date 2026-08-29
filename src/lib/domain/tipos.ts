/** Tipos do dominio compartilhados entre o calculo, as telas e os documentos. */
import type { Centavos, DataISO } from '@/lib/format'

export type PerfilUsuario = 'admin' | 'lancador'

export type TipoPessoa = 'funcionario' | 'parceiro'

export type TipoDiaria = 'cheia' | 'meia' | 'sem_diaria'

export type FormaContratacao = 'diaria' | 'empreitada' | 'medicao' | 'unidade'

export type StatusObra = 'orcada' | 'em_andamento' | 'paralisada' | 'concluida'

export type StatusSemana = 'aberta' | 'fechada'

export type PagoPor = 'rv' | 'cliente'

export type CategoriaNota =
  | 'material'
  | 'locacao'
  | 'cacamba'
  | 'terceiro'
  | 'combustivel'
  | 'outro'

export type StatusParcela = 'prevista' | 'paga' | 'atrasada'

export type ModoBdi = 'visivel' | 'embutido' | 'sem_bdi'

export interface Funcionario {
  id: string
  nome: string
  tipo: TipoPessoa
  funcao: string
  valor_diaria: Centavos
  telefone: string | null
  chave_pix: string | null
  status: 'ativo' | 'desligado' | 'alocado'
  data_entrada: DataISO | null
  data_saida: DataISO | null
}

export interface LancamentoDiario {
  id: string
  obra_id: string
  semana_id: string | null
  funcionario_id: string
  data: DataISO
  tipo_diaria: TipoDiaria
  /** Valor efetivamente aplicado no dia — congelado no lancamento. */
  valor_diaria: Centavos
  valor_vale: Centavos
  observacao: string | null
}

export interface PagamentoFuncionario {
  id: string
  obra_id: string
  semana_id: string | null
  funcionario_id: string
  valor: Centavos
  data_pagamento: DataISO
  forma_pagamento: string | null
  comprovante_url: string | null
  observacao: string | null
}

export interface Quentinha {
  id: string
  obra_id: string
  semana_id: string | null
  data: DataISO
  quantidade: number
  valor_unitario: Centavos
}

export interface Semana {
  id: string
  obra_id: string
  numero: number
  data_inicio: DataISO
  data_fim: DataISO
  dias_sem_expediente: DataISO[]
  status: StatusSemana
}

export interface NotaFiscal {
  id: string
  obra_id: string | null
  semana_id: string | null
  data: DataISO
  fornecedor_id: string | null
  fornecedor_nome: string
  numero_nota: string | null
  categoria: CategoriaNota
  descricao: string
  valor: Centavos
  forma_pagamento: string | null
  pago_por: PagoPor
  conferida: boolean
  repassada_em: DataISO | null
  anotacao_interna: string | null
  a_confirmar: boolean
  qtd_fotos: number
}

export interface RateioNota {
  id: string
  nota_id: string
  local_id: string | null
  obra_id: string | null
  valor: Centavos
}

export interface DespesaSemNota {
  id: string
  obra_id: string
  data: DataISO
  descricao: string
  categoria: CategoriaNota
  valor: Centavos
  pago_a: string | null
  repassar_cliente: boolean
}

export interface Pagamento {
  id: string
  obra_id: string
  numero_parcela: number
  valor_previsto: Centavos
  data_prevista: DataISO | null
  valor_recebido: Centavos | null
  data_recebimento: DataISO | null
  forma_pagamento: string | null
  comprovante_url: string | null
  /** Parte do comprovante que pertence a outro contrato — nao entra nesta obra. */
  valor_outro_contrato: Centavos
  observacao: string | null
  status: StatusParcela
  balao: boolean
}
