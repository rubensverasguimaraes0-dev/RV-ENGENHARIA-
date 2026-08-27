/**
 * Cotacao e proposta de energia solar (spec 5.5 a 5.7).
 *
 * A cotacao e montada com a base de precos dos fornecedores; sobre o custo
 * total aplica-se a margem configurada. Regra do item 5.7 e da regra geral
 * 11.1: a margem e o custo de fornecedor nunca aparecem na proposta — por isso
 * este modulo devolve dois blocos separados, `custo` (interno) e `proposta`
 * (o que pode ser impresso).
 */
import type { Centavos } from '@/lib/format'
import { aplicarFator } from '@/lib/format'
import type { Dimensionamento } from './solar'

export type CategoriaSolar =
  | 'modulo'
  | 'inversor'
  | 'estrutura'
  | 'cabo'
  | 'conector'
  | 'stringbox'
  | 'eletrico'
  | 'frete'

export interface PrecoDeItem {
  descricao: string
  preco_unitario: Centavos
  /** vigente | antigo | vencido — sinaliza cotacao velha */
  situacao?: 'vigente' | 'antigo' | 'vencido'
  fornecedor?: string
}

export interface ParametrosProposta {
  /** valor fixo de projeto, ART e homologacao */
  projeto_art: Centavos
  /** mao de obra de instalacao, em centavos por kWp */
  mao_obra_kwp: Centavos
  /** margem sobre o custo total; nunca aparece na proposta */
  margem: number
  /** frete: valor informado, ou percentual do custo quando o valor e zero */
  frete_valor?: Centavos
  frete_percentual?: number
  /** distancia do quadro ate os modulos, em metros */
  distancia_quadro_m: number
}

export interface ItemProposta {
  categoria: CategoriaSolar | 'servico'
  descricao: string
  unidade: string
  quantidade: number
  /** custo unitario — interno */
  custo_unitario: Centavos
  /** custo total do item — interno */
  custo_total: Centavos
  fornecedor?: string
  situacao?: 'vigente' | 'antigo' | 'vencido'
}

export interface CotacaoSolar {
  itens: ItemProposta[]
  custo_equipamentos: Centavos
  custo_servicos: Centavos
  custo_frete: Centavos
  custo_total: Centavos
  /** o que o cliente paga */
  preco_venda: Centavos
  /** interno */
  margem_valor: Centavos
  /** itens cujo preco esta vencido ou antigo */
  alertas: string[]
}

/**
 * Monta a cotacao a partir do dimensionamento e da base de precos.
 * O que nao tem preco na base entra com custo zero e sai listado em `alertas`,
 * para nao gerar proposta com item faltando sem ninguem perceber.
 */
export function montarCotacaoSolar(entrada: {
  dimensionamento: Dimensionamento
  precos: Partial<Record<CategoriaSolar, PrecoDeItem>>
  parametros: ParametrosProposta
}): CotacaoSolar {
  const { dimensionamento: d, precos, parametros: p } = entrada
  const itens: ItemProposta[] = []
  const alertas: string[] = []

  const adicionar = (
    categoria: CategoriaSolar,
    quantidade: number,
    unidade: string,
    descricaoPadrao: string,
  ) => {
    const preco = precos[categoria]
    if (!preco) {
      alertas.push(`Sem preço na base para: ${descricaoPadrao}.`)
    } else if (preco.situacao && preco.situacao !== 'vigente') {
      alertas.push(
        `Preço ${preco.situacao === 'vencido' ? 'vencido' : 'com mais de 30 dias'}: ${preco.descricao}.`,
      )
    }

    const custo_unitario = preco?.preco_unitario ?? 0
    itens.push({
      categoria,
      descricao: preco?.descricao ?? descricaoPadrao,
      unidade,
      quantidade,
      custo_unitario,
      custo_total: Math.round(quantidade * custo_unitario),
      fornecedor: preco?.fornecedor,
      situacao: preco?.situacao,
    })
  }

  // Equipamentos, nas quantidades que o dimensionamento define
  adicionar('modulo', d.qtd_modulos, 'un', 'Módulos fotovoltaicos')
  adicionar('inversor', 1, 'un', `Inversor compatível com ${d.potencia_inversor_kw.toFixed(2)} kW`)
  adicionar('estrutura', d.qtd_modulos, 'un', 'Estrutura de fixação (por módulo)')
  // cabo: ida e volta ate o quadro
  adicionar('cabo', Math.ceil(p.distancia_quadro_m * 2), 'm', 'Cabo solar')
  adicionar('conector', 2, 'par', 'Conectores MC4')
  adicionar('stringbox', 1, 'un', 'String box e proteções CC e CA')
  adicionar('eletrico', 1, 'un', 'Disjuntor e materiais elétricos')

  const custo_equipamentos = itens.reduce((s, i) => s + i.custo_total, 0)

  // Servicos: valores fixos e por kWp, dos parametros
  const maoDeObra = Math.round(d.potencia_instalada_kwp * p.mao_obra_kwp)
  itens.push({
    categoria: 'servico',
    descricao: 'Projeto, ART e homologação junto à concessionária',
    unidade: 'vb',
    quantidade: 1,
    custo_unitario: p.projeto_art,
    custo_total: p.projeto_art,
  })
  itens.push({
    categoria: 'servico',
    descricao: 'Mão de obra de instalação',
    unidade: 'kWp',
    quantidade: Math.round(d.potencia_instalada_kwp * 100) / 100,
    custo_unitario: p.mao_obra_kwp,
    custo_total: maoDeObra,
  })

  const custo_servicos = p.projeto_art + maoDeObra

  // Frete: valor informado manda; sem ele, aplica-se o percentual sobre o custo
  const baseFrete = custo_equipamentos + custo_servicos
  const custo_frete =
    p.frete_valor && p.frete_valor > 0
      ? p.frete_valor
      : p.frete_percentual
        ? aplicarFator(baseFrete, p.frete_percentual)
        : 0

  if (custo_frete > 0) {
    itens.push({
      categoria: 'frete',
      descricao: 'Frete',
      unidade: 'vb',
      quantidade: 1,
      custo_unitario: custo_frete,
      custo_total: custo_frete,
    })
  }

  const custo_total = custo_equipamentos + custo_servicos + custo_frete
  const preco_venda = aplicarFator(custo_total, 1 + p.margem)

  return {
    itens,
    custo_equipamentos,
    custo_servicos,
    custo_frete,
    custo_total,
    preco_venda,
    margem_valor: preco_venda - custo_total,
    alertas,
  }
}

/**
 * Lista de equipamentos e servicos como sai na proposta: descricao e
 * quantidade, sem preco item a item — apenas o valor global (spec 5.7, item 6).
 */
export function itensParaProposta(cotacao: CotacaoSolar): { descricao: string; quantidade: string }[] {
  return cotacao.itens
    .filter((i) => i.categoria !== 'frete')
    .map((i) => ({
      descricao: i.descricao,
      quantidade:
        i.unidade === 'vb'
          ? '—'
          : `${formatarQuantidade(i.quantidade)} ${i.unidade}`,
    }))
}

function formatarQuantidade(v: number): string {
  return (Math.round(v * 100) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

/**
 * Confere que nada de custo ou margem escapou para o conteudo da proposta.
 * Usado em teste: e a regra 11.1 virando verificacao.
 */
export function valoresProibidosNaProposta(cotacao: CotacaoSolar): Centavos[] {
  return [
    ...cotacao.itens.map((i) => i.custo_unitario),
    ...cotacao.itens.map((i) => i.custo_total),
    cotacao.custo_total,
    cotacao.margem_valor,
  ].filter((v) => v > 0)
}
