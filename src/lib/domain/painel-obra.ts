/**
 * O que o painel da obra mostra alem dos totais.
 *
 * Os dados ja estavam no banco — 82 presencas individuais, semana a semana —
 * e a tela mostrava so a soma. Aqui eles viram duas leituras que respondem
 * perguntas que a soma nao responde: quem custou quanto, e como o custo e o
 * recebimento andaram no tempo.
 *
 * Fica no dominio, e nao na tela, porque sao contas sobre dinheiro.
 */
import type { Centavos, DataISO } from '@/lib/format'
import { custoDoLancamento } from './fechamento-semanal'
import type { Funcionario, LancamentoDiario, Pagamento, Quentinha, Semana } from './tipos'

export interface LinhaDaEquipe {
  funcionario_id: string
  nome: string
  funcao: string
  dias_cheios: number
  dias_meios: number
  dias_sem_diaria: number
  /** Cheia conta 1, meia conta 0,5 — o mesmo criterio da planilha. */
  diarias: number
  total: Centavos
  primeira: DataISO
  ultima: DataISO
  /** Fracao do custo de mao de obra da obra: 0,467 = 46,7%. */
  fracao: number
}

/**
 * Custo de mao de obra por pessoa, do maior para o menor.
 *
 * Ordena por valor e nao por nome: numa obra de dez pessoas, quem pesa no
 * custo tem de aparecer primeiro, sem precisar procurar.
 */
export function resumirEquipe(
  lancamentos: LancamentoDiario[],
  funcionarios: Funcionario[],
): LinhaDaEquipe[] {
  const porId = new Map(funcionarios.map((f) => [f.id, f]))
  const linhas = new Map<string, LinhaDaEquipe>()

  for (const l of lancamentos) {
    let linha = linhas.get(l.funcionario_id)
    if (!linha) {
      const f = porId.get(l.funcionario_id)
      linha = {
        funcionario_id: l.funcionario_id,
        // Funcionario apagado do cadastro nao apaga o custo que ele gerou.
        nome: f?.nome ?? 'Funcionário removido',
        funcao: f?.funcao ?? '',
        dias_cheios: 0,
        dias_meios: 0,
        dias_sem_diaria: 0,
        diarias: 0,
        total: 0,
        primeira: l.data,
        ultima: l.data,
        fracao: 0,
      }
      linhas.set(l.funcionario_id, linha)
    }

    if (l.tipo_diaria === 'cheia') {
      linha.dias_cheios += 1
      linha.diarias += 1
    } else if (l.tipo_diaria === 'meia') {
      linha.dias_meios += 1
      linha.diarias += 0.5
    } else {
      linha.dias_sem_diaria += 1
    }

    linha.total += custoDoLancamento(l)
    if (l.data < linha.primeira) linha.primeira = l.data
    if (l.data > linha.ultima) linha.ultima = l.data
  }

  const lista = [...linhas.values()]
  const total = lista.reduce((s, l) => s + l.total, 0)
  for (const l of lista) l.fracao = total > 0 ? l.total / total : 0

  return lista.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'))
}

export interface PontoDaEvolucao {
  semana: number
  data_inicio: DataISO
  data_fim: DataISO
  mao_obra: Centavos
  alimentacao: Centavos
  custo: Centavos
  custo_acumulado: Centavos
  /** Recebido do cliente ate o fim desta semana. */
  recebido_acumulado: Centavos
}

/**
 * A obra semana a semana, com os dois acumulados lado a lado.
 *
 * O recebido e acumulado por DATA, nao por semana: a parcela cai quando cai,
 * sem relacao com a semana de obra. Somar por semana daria a impressao de que
 * o cliente paga por semana trabalhada, o que nao e o caso numa empreitada.
 */
export function evolucaoDaObra(entrada: {
  semanas: Semana[]
  lancamentos: LancamentoDiario[]
  quentinhas: Quentinha[]
  pagamentos: Pagamento[]
}): PontoDaEvolucao[] {
  const semanas = [...entrada.semanas].sort((a, b) =>
    a.data_inicio < b.data_inicio ? -1 : a.data_inicio > b.data_inicio ? 1 : 0,
  )

  let custoAcumulado = 0

  return semanas.map((s) => {
    const dentro = (d: DataISO) => d >= s.data_inicio && d <= s.data_fim

    const mao_obra = entrada.lancamentos
      .filter((l) => dentro(l.data))
      .reduce((soma, l) => soma + custoDoLancamento(l), 0)

    const alimentacao = entrada.quentinhas
      .filter((q) => dentro(q.data))
      .reduce((soma, q) => soma + q.quantidade * q.valor_unitario, 0)

    const custo = mao_obra + alimentacao
    custoAcumulado += custo

    const recebido_acumulado = entrada.pagamentos
      .filter((p) => p.data_recebimento !== null && p.data_recebimento <= s.data_fim)
      .reduce((soma, p) => soma + (p.valor_recebido ?? 0) - (p.valor_outro_contrato ?? 0), 0)

    return {
      semana: s.numero,
      data_inicio: s.data_inicio,
      data_fim: s.data_fim,
      mao_obra,
      alimentacao,
      custo,
      custo_acumulado: custoAcumulado,
      recebido_acumulado,
    }
  })
}
