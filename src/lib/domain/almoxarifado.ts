/**
 * Almoxarifado da obra (spec 4.10) — material proprio da RV guardado na obra.
 *
 * Pontos que a especificacao trata como regra, e nao como detalhe de tela:
 *  - itens agrupados por categoria, grafia em caixa alta, sem coluna de codigo
 *    e sem coluna de local;
 *  - o custo unitario nunca aparece no documento do cliente; o que aparece e o
 *    valor de cobranca;
 *  - cabo eletrico e lancado por pedaco: cada pedaco e uma linha com sua
 *    metragem, com subtotal por cor e bitola, para dar baixa pedaco a pedaco;
 *  - itens podem ficar sem quantidade definida (a contar depois);
 *  - as saidas marcadas para cobranca alimentam o fechamento, ja com valor.
 */
import type { Centavos, DataISO } from '@/lib/format'

export interface ItemAlmoxarifado {
  id: string
  obra_id: string
  categoria: string
  descricao: string
  unidade: string | null
  /** null = a contar depois */
  quantidade: number | null
  cor_bitola: string | null
  /** metragem do pedaco, para cabo */
  metragem: number | null
  custo_unitario: Centavos | null
  valor_cobranca: Centavos | null
}

export interface SaidaAlmoxarifado {
  id: string
  item_id: string
  data: DataISO
  quantidade: number
  quem_pegou: string | null
  onde_usou: string | null
  cobrar_cliente: boolean
}

export interface ItemComSaldo extends ItemAlmoxarifado {
  /** soma das saidas do item */
  total_saidas: number
  /** quantidade - saidas; null quando a quantidade ainda nao foi contada */
  saldo: number | null
  /** metragem que sobrou do pedaco de cabo, quando ha metragem */
  saldo_metragem: number | null
  quantidade_cobrada: number
  valor_cobrado: Centavos
  custo_saidas: Centavos
}

export function calcularSaldos(
  itens: ItemAlmoxarifado[],
  saidas: SaidaAlmoxarifado[],
): ItemComSaldo[] {
  return itens.map((item) => {
    const minhas = saidas.filter((s) => s.item_id === item.id)
    const total_saidas = minhas.reduce((s, x) => s + x.quantidade, 0)
    const cobradas = minhas.filter((s) => s.cobrar_cliente)
    const quantidade_cobrada = cobradas.reduce((s, x) => s + x.quantidade, 0)

    return {
      ...item,
      total_saidas,
      saldo: item.quantidade === null ? null : arredondar(item.quantidade - total_saidas),
      // cabo: cada pedaco tem sua metragem, e a baixa desconta dela
      saldo_metragem: item.metragem === null ? null : arredondar(item.metragem - total_saidas),
      quantidade_cobrada,
      valor_cobrado: Math.round(quantidade_cobrada * (item.valor_cobranca ?? 0)),
      custo_saidas: Math.round(total_saidas * (item.custo_unitario ?? 0)),
    }
  })
}

export interface GrupoCategoria {
  categoria: string
  itens: ItemComSaldo[]
  /** subtotais por cor e bitola, usados nos cabos */
  subgrupos: SubgrupoCorBitola[]
  valor_cobrado: Centavos
  custo: Centavos
}

export interface SubgrupoCorBitola {
  cor_bitola: string
  quantidade_pedacos: number
  metragem_total: number
  metragem_restante: number
  valor_cobrado: Centavos
}

/** Agrupa por categoria, com a grafia em caixa alta e ordem alfabetica. */
export function agruparPorCategoria(itens: ItemComSaldo[]): GrupoCategoria[] {
  const mapa = new Map<string, ItemComSaldo[]>()
  for (const item of itens) {
    const chave = (item.categoria || 'OUTROS').toUpperCase()
    mapa.set(chave, [...(mapa.get(chave) ?? []), item])
  }

  return [...mapa.entries()]
    .map(([categoria, lista]) => ({
      categoria,
      itens: [...lista].sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR')),
      subgrupos: subtotaisPorCorBitola(lista),
      valor_cobrado: lista.reduce((s, i) => s + i.valor_cobrado, 0),
      custo: lista.reduce((s, i) => s + i.custo_saidas, 0),
    }))
    .sort((a, b) => a.categoria.localeCompare(b.categoria, 'pt-BR'))
}

/**
 * Subtotal por cor e bitola: cada pedaco de cabo e uma linha, e o subtotal
 * mostra quantos pedacos, quanto foi comprado e quanto ainda resta.
 */
export function subtotaisPorCorBitola(itens: ItemComSaldo[]): SubgrupoCorBitola[] {
  const mapa = new Map<string, SubgrupoCorBitola>()

  for (const item of itens) {
    if (!item.cor_bitola) continue
    const chave = item.cor_bitola.toUpperCase()
    const atual = mapa.get(chave) ?? {
      cor_bitola: chave,
      quantidade_pedacos: 0,
      metragem_total: 0,
      metragem_restante: 0,
      valor_cobrado: 0,
    }
    atual.quantidade_pedacos += 1
    atual.metragem_total += item.metragem ?? 0
    atual.metragem_restante += item.saldo_metragem ?? item.metragem ?? 0
    atual.valor_cobrado += item.valor_cobrado
    mapa.set(chave, atual)
  }

  return [...mapa.values()]
    .map((g) => ({
      ...g,
      metragem_total: arredondar(g.metragem_total),
      metragem_restante: arredondar(g.metragem_restante),
    }))
    .sort((a, b) => a.cor_bitola.localeCompare(b.cor_bitola, 'pt-BR'))
}

export interface ResumoAlmoxarifado {
  grupos: GrupoCategoria[]
  /** o que vai valorado para o fechamento com o cliente */
  total_cobrado: Centavos
  /** apuracao interna: nunca sai em documento de cliente */
  custo_total_saidas: Centavos
  itens_sem_quantidade: number
}

export function resumirAlmoxarifado(
  itens: ItemAlmoxarifado[],
  saidas: SaidaAlmoxarifado[],
): ResumoAlmoxarifado {
  const comSaldo = calcularSaldos(itens, saidas)
  const grupos = agruparPorCategoria(comSaldo)

  return {
    grupos,
    total_cobrado: comSaldo.reduce((s, i) => s + i.valor_cobrado, 0),
    custo_total_saidas: comSaldo.reduce((s, i) => s + i.custo_saidas, 0),
    itens_sem_quantidade: comSaldo.filter((i) => i.quantidade === null).length,
  }
}

/** Evita o 0.30000000000000004 em metragem de cabo. */
function arredondar(v: number): number {
  return Math.round(v * 10000) / 10000
}
