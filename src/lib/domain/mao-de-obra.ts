/**
 * Relatorio interno de mao de obra — custo realizado.
 *
 * Formato de Relatorio_Mao_de_Obra_Piso_Industrial_REVEST.pdf: um bloco por dia
 * trabalhado, o resumo financeiro contra a verba de mao de obra do orcamento e
 * o resumo por pessoa.
 *
 * A regra que da sentido ao documento: quem executa a obra pelo lado da RV
 * (o engenheiro e o parceiro) NAO tira diaria. Eles dividem o que sobrou da
 * verba depois de pagas as diarias dos ajudantes e a alimentacao. No PDF de
 * referencia sao R$ 3.500,00 de verba, R$ 1.018,00 pagos e R$ 2.482,00
 * divididos entre duas pessoas — R$ 1.241,00 para cada.
 *
 * Documento interno: mostra custo e divisao de sobra, e nunca vai ao cliente
 * (spec 11.1).
 */
import type { Centavos, DataISO } from '@/lib/format'
import { aplicarFator, nomeDoDia } from '@/lib/format'
import type { Funcionario, LancamentoDiario, Quentinha } from './tipos'
import { custoDoLancamento, fatorDePresenca } from './fechamento-semanal'

export interface PessoaNoDia {
  funcionario_id: string
  nome: string
  funcao: string
  /** Parceiro de execucao nao tira diaria: sai com "—" nas duas colunas. */
  executor: boolean
  diarias: number
  valor: Centavos
}

export interface DiaDeMaoDeObra {
  data: DataISO
  nome_dia: string
  pessoas: PessoaNoDia[]
  qtd_quentinhas: number
  valor_quentinha: Centavos
  custo_alimentacao: Centavos
  custo_diarias: Centavos
  total_dia: Centavos
}

export interface LinhaPorPessoa {
  funcionario_id: string
  nome: string
  executor: boolean
  total: Centavos
}

export interface RelatorioMaoDeObra {
  dias: DiaDeMaoDeObra[]
  /** Diarias efetivamente pagas aos ajudantes. */
  total_diarias: Centavos
  total_alimentacao: Centavos
  /** O que saiu do caixa: diarias + alimentacao. */
  total_pago: Centavos
  /** Verba de mao de obra do orcamento. Zero quando nao informada. */
  verba: Centavos
  /** verba - total_pago, nunca negativo. */
  saldo: Centavos
  /** Quem divide o saldo: os executores que apareceram em algum dia. */
  executores: LinhaPorPessoa[]
  /** Quanto cabe a cada executor. */
  parte_de_cada_executor: Centavos
  /** Uma linha por ajudante, mais alimentacao — o bloco "resumo por pessoa". */
  por_pessoa: LinhaPorPessoa[]
  /** total_pago + o saldo dividido: fecha na verba quando ela existe. */
  total_geral: Centavos
}

export function montarRelatorioMaoDeObra(input: {
  lancamentos: LancamentoDiario[]
  quentinhas: Quentinha[]
  funcionarios: Funcionario[]
  verba: Centavos
}): RelatorioMaoDeObra {
  const { lancamentos, quentinhas, funcionarios, verba } = input
  const porId = new Map(funcionarios.map((f) => [f.id, f]))

  const datas = [...new Set([...lancamentos.map((l) => l.data), ...quentinhas.map((q) => q.data)])]
    .sort()

  const dias: DiaDeMaoDeObra[] = datas.map((data) => {
    const doDia = lancamentos.filter((l) => l.data === data)
    const pessoas: PessoaNoDia[] = doDia
      .map((l) => {
        const f = porId.get(l.funcionario_id)
        const executor = f?.tipo === 'parceiro'
        return {
          funcionario_id: l.funcionario_id,
          nome: f?.nome ?? '(funcionário removido)',
          funcao: executor ? 'Execução / RV Engenharia' : (f?.funcao ?? ''),
          executor,
          // O executor entra na lista do dia para constar quem esteve na obra,
          // mas sem diaria e sem valor — e o "—" do PDF de referencia.
          diarias: executor ? 0 : fatorDePresenca(l.tipo_diaria),
          valor: executor ? 0 : custoDoLancamento(l),
        }
      })
      .sort(ordenarPessoas)

    const qDia = quentinhas.filter((q) => q.data === data)
    const qtd_quentinhas = qDia.reduce((s, q) => s + q.quantidade, 0)
    const custo_alimentacao = qDia.reduce((s, q) => s + q.quantidade * q.valor_unitario, 0)
    const custo_diarias = pessoas.reduce((s, p) => s + p.valor, 0)

    return {
      data,
      nome_dia: nomeDoDia(data),
      pessoas,
      qtd_quentinhas,
      // Preco unitario do dia. Quando ha mais de um, mostra o primeiro; o
      // relatorio de despesa e que separa por faixa.
      valor_quentinha: qDia[0]?.valor_unitario ?? 0,
      custo_alimentacao,
      custo_diarias,
      total_dia: custo_diarias + custo_alimentacao,
    }
  })

  const total_diarias = dias.reduce((s, d) => s + d.custo_diarias, 0)
  const total_alimentacao = dias.reduce((s, d) => s + d.custo_alimentacao, 0)
  const total_pago = total_diarias + total_alimentacao

  // Verba menor que o pago nao vira divida do executor: o saldo para em zero e
  // o relatorio mostra o estouro pelo proprio total.
  const saldo = Math.max(verba - total_pago, 0)

  const executores = agruparPorPessoa(dias, true)
  const parte_de_cada_executor =
    executores.length > 0 ? repartir(saldo, executores.length) : 0

  return {
    dias,
    total_diarias,
    total_alimentacao,
    total_pago,
    verba,
    saldo,
    executores: executores.map((e) => ({ ...e, total: parte_de_cada_executor })),
    parte_de_cada_executor,
    por_pessoa: agruparPorPessoa(dias, false),
    total_geral: total_pago + parte_de_cada_executor * executores.length,
  }
}

// -----------------------------------------------------------------------------

function agruparPorPessoa(dias: DiaDeMaoDeObra[], executores: boolean): LinhaPorPessoa[] {
  const mapa = new Map<string, LinhaPorPessoa>()
  for (const dia of dias) {
    for (const p of dia.pessoas) {
      if (p.executor !== executores) continue
      const atual = mapa.get(p.funcionario_id) ?? {
        funcionario_id: p.funcionario_id,
        nome: p.nome,
        executor: p.executor,
        total: 0,
      }
      atual.total += p.valor
      mapa.set(p.funcionario_id, atual)
    }
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/**
 * Divide o saldo em partes iguais, para baixo ao centavo. Dividir R$ 2.482,00
 * por dois da R$ 1.241,00 exato; numa divisao com sobra, o centavo que resta
 * fica sem dono em vez de inflar uma das partes — e o total do relatorio
 * continua sendo o que saiu do caixa mais o que foi dividido.
 */
function repartir(saldo: Centavos, partes: number): Centavos {
  return partes > 0 ? aplicarFator(saldo, 1 / partes) : 0
}

function ordenarPessoas(a: PessoaNoDia, b: PessoaNoDia): number {
  // Ajudantes primeiro, executores no fim — a ordem do PDF de referencia.
  if (a.executor !== b.executor) return a.executor ? 1 : -1
  return a.nome.localeCompare(b.nome, 'pt-BR')
}
