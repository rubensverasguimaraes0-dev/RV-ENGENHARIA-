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
import { nomeDoMes, type Centavos, type DataISO } from '@/lib/format'
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


export interface MesDaObra {
  /** aaaa-mm, para ordenar */
  chave: string
  /** AGOSTO/2026 */
  rotulo: string
  /** parcelas com vencimento no mes — o que era para entrar */
  previsto: Centavos
  /** o que entrou de fato, ja descontado o que e de outro contrato */
  recebido: Centavos
  custo_mao_obra: Centavos
  custo_alimentacao: Centavos
  custo_materiais: Centavos
  custo: Centavos
  /** recebido menos custo: o que sobrou no mes */
  sobrou: Centavos
  /** soma corrida do que sobrou, mes a mes */
  sobrou_acumulado: Centavos
  /** mes que ainda nao chegou: os valores sao estimativa, nao historico */
  futuro: boolean
}

/**
 * A obra mes a mes: o que era para entrar, o que entrou, o que saiu e o que
 * sobrou.
 *
 * Meses futuros entram na lista, com o previsto das parcelas e custo zero. Nao
 * e engano: e a estimativa do que ainda vem, e sem ela a tabela para no mes
 * corrente e nao ajuda a planejar. O campo `futuro` marca esses meses para a
 * tela dizer, com todas as letras, que ali e estimativa.
 *
 * "Sobrou" e caixa do mes, nao lucro: e o que entrou menos o que saiu naquele
 * mes. Numa empreitada as parcelas nao acompanham o ritmo da obra, entao um mes
 * pode sobrar muito e o seguinte faltar, sem que nada tenha mudado no negocio.
 */
export function resumoMensal(entrada: {
  pagamentos: Pagamento[]
  lancamentos: LancamentoDiario[]
  quentinhas: Quentinha[]
  /** notas e despesas: qualquer custo com data e valor */
  materiais: { data: DataISO; valor: Centavos }[]
  hoje: DataISO
}): MesDaObra[] {
  const meses = new Map<string, MesDaObra>()
  const mesDeHoje = entrada.hoje.slice(0, 7)

  const pegar = (data: DataISO): MesDaObra => {
    const chave = data.slice(0, 7)
    let mes = meses.get(chave)
    if (!mes) {
      mes = {
        chave,
        rotulo: nomeDoMes(data),
        previsto: 0,
        recebido: 0,
        custo_mao_obra: 0,
        custo_alimentacao: 0,
        custo_materiais: 0,
        custo: 0,
        sobrou: 0,
        sobrou_acumulado: 0,
        futuro: chave > mesDeHoje,
      }
      meses.set(chave, mes)
    }
    return mes
  }

  for (const p of entrada.pagamentos) {
    if (p.data_prevista) pegar(p.data_prevista).previsto += p.valor_previsto
    if (p.data_recebimento && p.valor_recebido !== null) {
      pegar(p.data_recebimento).recebido += p.valor_recebido - (p.valor_outro_contrato ?? 0)
    }
  }

  for (const l of entrada.lancamentos) pegar(l.data).custo_mao_obra += custoDoLancamento(l)
  for (const q of entrada.quentinhas) {
    pegar(q.data).custo_alimentacao += q.quantidade * q.valor_unitario
  }
  for (const m of entrada.materiais) pegar(m.data).custo_materiais += m.valor

  const lista = [...meses.values()].sort((a, b) => (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0))

  let acumulado = 0
  for (const m of lista) {
    m.custo = m.custo_mao_obra + m.custo_alimentacao + m.custo_materiais
    m.sobrou = m.recebido - m.custo
    acumulado += m.sobrou
    m.sobrou_acumulado = acumulado
  }

  return lista
}
