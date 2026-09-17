/**
 * Conferencia da obra — o checklist que o proprio aplicativo levanta.
 *
 * Existe porque um checklist feito de fora e palpite: so quem le o banco sabe
 * o que esta lancado. Esta funcao olha os dados reais e responde, por area,
 * o que esta em dia, o que merece atencao e o que esta pendente.
 *
 * Tela interna: fala de custo, atraso e lucro (spec 11.1).
 */
import type { Centavos, DataISO } from '@/lib/format'
import { diaDaSemana, diferencaEmDias, formatarMoeda, somarDias } from '@/lib/format'

export type Situacao = 'ok' | 'atencao' | 'pendente'
export type Area = 'recebimentos' | 'presenca' | 'equipe' | 'custos'

export interface Achado {
  area: Area
  titulo: string
  detalhe: string
  situacao: Situacao
}

export interface ParcelaParaConferir {
  numero_parcela: number
  valor_previsto: Centavos
  data_prevista: DataISO | null
  data_recebimento: DataISO | null
  paga: boolean
  tem_comprovante: boolean
}

export interface SemanaParaConferir {
  id: string
  numero: number
  data_inicio: DataISO
  data_fim: DataISO
  fechada: boolean
  /** Dias distintos com algum lancamento dentro da semana. */
  dias_lancados: number
  /** Ha pagamento de funcionario registrado nesta semana. */
  tem_pagamento: boolean
}

export interface CustosLancados {
  materiais: Centavos
  despesas_sem_nota: Centavos
  locacoes: Centavos
  entulho: Centavos
  terceiros: Centavos
}

export interface EntradaConferencia {
  hoje: DataISO
  parcelas: ParcelaParaConferir[]
  semanas: SemanaParaConferir[]
  custos: CustosLancados
  /** Ultimo dia com lancamento em toda a obra. */
  ultimo_dia_lancado: DataISO | null
  /**
   * Falso quando a tabela de pagamentos da equipe ainda nao existe no banco
   * (migracao pendente). Sem isso a conferencia acusaria "nao pagou" para
   * semanas que na verdade nao tem onde ser registradas.
   */
  pagamentos_equipe_disponivel?: boolean
}

/** Quantos dias uma parcela esta vencida. Zero quando ainda nao venceu. */
export function diasEmAtraso(p: ParcelaParaConferir, hoje: DataISO): number {
  if (p.paga || !p.data_prevista || p.data_prevista >= hoje) return 0
  return diferencaEmDias(p.data_prevista, hoje)
}

export function conferirObra(e: EntradaConferencia): Achado[] {
  return [
    ...conferirRecebimentos(e),
    ...conferirPresenca(e),
    ...conferirEquipe(e),
    ...conferirCustos(e),
  ]
}

// -----------------------------------------------------------------------------

function conferirRecebimentos(e: EntradaConferencia): Achado[] {
  const achados: Achado[] = []
  const area: Area = 'recebimentos'

  const atrasadas = e.parcelas
    .filter((p) => diasEmAtraso(p, e.hoje) > 0)
    .sort((a, b) => a.numero_parcela - b.numero_parcela)

  if (atrasadas.length > 0) {
    const total = atrasadas.reduce((s, p) => s + p.valor_previsto, 0)
    const pior = Math.max(...atrasadas.map((p) => diasEmAtraso(p, e.hoje)))
    achados.push({
      area,
      titulo: `${formatarMoeda(total)} em atraso`,
      detalhe:
        `Parcela${atrasadas.length > 1 ? 's' : ''} ${atrasadas.map((p) => p.numero_parcela).join(', ')}. ` +
        `A mais antiga está ${pior} dia${pior > 1 ? 's' : ''} vencida.`,
      situacao: 'pendente',
    })
  }

  // Proxima a vencer: so avisa dentro de uma semana, para nao virar ruido.
  const proxima = e.parcelas
    .filter((p) => !p.paga && p.data_prevista && p.data_prevista >= e.hoje)
    .sort((a, b) => (a.data_prevista! < b.data_prevista! ? -1 : 1))[0]

  if (proxima?.data_prevista) {
    const faltam = diferencaEmDias(e.hoje, proxima.data_prevista)
    if (faltam <= 7) {
      achados.push({
        area,
        titulo: `Parcela ${proxima.numero_parcela} vence em ${faltam} dia${faltam === 1 ? '' : 's'}`,
        detalhe: 'Vale combinar o recebimento antes do vencimento.',
        situacao: 'atencao',
      })
    }
  }

  const semComprovante = e.parcelas.filter((p) => p.paga && !p.tem_comprovante)
  if (semComprovante.length > 0) {
    achados.push({
      area,
      titulo: `${semComprovante.length} parcela${semComprovante.length > 1 ? 's' : ''} paga${semComprovante.length > 1 ? 's' : ''} sem comprovante`,
      detalhe:
        `Parcela${semComprovante.length > 1 ? 's' : ''} ${semComprovante.map((p) => p.numero_parcela).join(', ')}. ` +
        'O anexo do cronograma sai vazio para elas.',
      situacao: 'atencao',
    })
  }

  if (achados.length === 0) {
    achados.push({
      area,
      titulo: 'Recebimentos em dia',
      detalhe: 'Nenhuma parcela vencida e nenhuma paga sem comprovante.',
      situacao: 'ok',
    })
  }

  return achados
}

function conferirPresenca(e: EntradaConferencia): Achado[] {
  const achados: Achado[] = []
  const area: Area = 'presenca'

  // Semana que ja terminou e continua aberta: o relatorio dela nao existe.
  const vencidasAbertas = e.semanas
    .filter((s) => !s.fechada && s.data_fim < e.hoje)
    .sort((a, b) => a.numero - b.numero)

  if (vencidasAbertas.length > 0) {
    achados.push({
      area,
      titulo: `${vencidasAbertas.length} semana${vencidasAbertas.length > 1 ? 's' : ''} por fechar`,
      detalhe:
        `Semana${vencidasAbertas.length > 1 ? 's' : ''} ${vencidasAbertas.map((s) => s.numero).join(', ')}. ` +
        'Enquanto não fecha, o relatório e o recibo da semana não saem.',
      situacao: 'pendente',
    })
  }

  const semLancamento = e.semanas.filter((s) => s.dias_lancados === 0 && s.data_fim < e.hoje)
  if (semLancamento.length > 0) {
    achados.push({
      area,
      titulo: `${semLancamento.length} semana${semLancamento.length > 1 ? 's' : ''} sem nenhum dia lançado`,
      detalhe: `Semana${semLancamento.length > 1 ? 's' : ''} ${semLancamento.map((s) => s.numero).join(', ')}.`,
      situacao: 'pendente',
    })
  }

  // Domingo nao conta: a obra nao trabalha, e cobrar lancamento seria ruido.
  const atraso = diasSemLancar(e.ultimo_dia_lancado, e.hoje)
  if (atraso === null) {
    achados.push({
      area,
      titulo: 'Nenhum dia lançado ainda',
      detalhe: 'A obra não tem presença registrada.',
      situacao: 'pendente',
    })
  } else if (atraso >= 2) {
    achados.push({
      area,
      titulo: `${atraso} dias úteis sem lançar a presença`,
      detalhe: 'Lançar no fim da tarde é o que evita ter de lembrar depois.',
      situacao: 'atencao',
    })
  }

  if (achados.length === 0) {
    achados.push({
      area,
      titulo: 'Presença em dia',
      detalhe: 'Semanas fechadas em ordem e lançamento do dia sem atraso.',
      situacao: 'ok',
    })
  }

  return achados
}

function conferirEquipe(e: EntradaConferencia): Achado[] {
  const area: Area = 'equipe'

  if (e.pagamentos_equipe_disponivel === false) {
    return [
      {
        area,
        titulo: 'A tela de pagamento da equipe ainda não funciona',
        detalhe:
          'A tabela que guarda esses pagamentos não chegou ao banco. Enquanto isso, não dá ' +
          'para conferir o que já foi pago à equipe.',
        situacao: 'pendente',
      },
    ]
  }

  const fechadasSemPagar = e.semanas
    .filter((s) => s.fechada && !s.tem_pagamento && s.dias_lancados > 0)
    .sort((a, b) => a.numero - b.numero)

  if (fechadasSemPagar.length === 0) {
    return [
      {
        area,
        titulo: 'Pagamentos da equipe registrados',
        detalhe: 'Toda semana fechada tem o pagamento lançado.',
        situacao: 'ok',
      },
    ]
  }

  return [
    {
      area,
      titulo: `${fechadasSemPagar.length} semana${fechadasSemPagar.length > 1 ? 's' : ''} fechada${fechadasSemPagar.length > 1 ? 's' : ''} sem pagamento lançado`,
      detalhe:
        `Semana${fechadasSemPagar.length > 1 ? 's' : ''} ${fechadasSemPagar.map((s) => s.numero).join(', ')}. ` +
        'O app sabe quanto a equipe custou, mas não quanto já saiu do caixa.',
      situacao: 'pendente',
    },
  ]
}

const ROTULO_CUSTO: [keyof CustosLancados, string][] = [
  ['materiais', 'material com nota'],
  ['despesas_sem_nota', 'despesa sem nota'],
  ['locacoes', 'locação de equipamento'],
  ['entulho', 'caçamba de entulho'],
  ['terceiros', 'serviço de terceiro'],
]

function conferirCustos(e: EntradaConferencia): Achado[] {
  const area: Area = 'custos'
  const vazios = ROTULO_CUSTO.filter(([chave]) => e.custos[chave] === 0).map(([, rotulo]) => rotulo)

  if (vazios.length === 0) {
    return [
      {
        area,
        titulo: 'Custos lançados em todas as frentes',
        detalhe: 'O resultado da obra está apurado sobre o custo cheio.',
        situacao: 'ok',
      },
    ]
  }

  return [
    {
      area,
      titulo: `${vazios.length} tipo${vazios.length > 1 ? 's' : ''} de custo zerado${vazios.length > 1 ? 's' : ''}`,
      detalhe:
        `Sem lançamento de ${listar(vazios)}. ` +
        'Enquanto faltar custo, o lucro aparece maior do que é — e ele vai cair quando o resto entrar.',
      situacao: vazios.length >= 3 ? 'pendente' : 'atencao',
    },
  ]
}

// -----------------------------------------------------------------------------

/**
 * Dias uteis desde o ultimo lancamento. Domingo nao entra na conta: a obra nao
 * trabalha, e cobrar lancamento de domingo seria ruido toda segunda de manha.
 */
export function diasSemLancar(ultimo: DataISO | null, hoje: DataISO): number | null {
  if (!ultimo) return null
  const total = diferencaEmDias(ultimo, hoje)
  if (total <= 0) return 0

  let uteis = 0
  for (let i = 1; i <= total; i++) {
    if (diaDaSemana(somarDias(ultimo, i)) !== 0) uteis++
  }
  return uteis
}

function listar(itens: string[]): string {
  if (itens.length === 1) return itens[0]!
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}
