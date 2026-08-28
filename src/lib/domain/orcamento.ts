/**
 * Orcamentos (spec 4.13), nas duas profundidades:
 *  - rapido: itens com unidade, quantidade, custo de material, custo de mao de
 *    obra e margem, com o preco de venda calculado;
 *  - completo: estrutura hierarquica por fases (1, 1.1, 1.1.1), itens proprios
 *    convivendo com itens de base referencial (SINAPI, ORSE, SICRO) e BDI.
 *
 * Regra absoluta (spec 4.13 e 11.1): custo de material, custo de mao de obra,
 * margem e BDI nunca aparecem na versao do cliente. Este modulo separa sempre
 * os numeros internos dos numeros que podem sair no documento.
 */
import type { Centavos } from '@/lib/format'
import { aplicarFator } from '@/lib/format'
import type { ModoBdi } from './tipos'

export type BaseReferencia = 'SINAPI' | 'ORSE' | 'SICRO' | 'proprio'

export interface ItemOrcamento {
  id: string
  /** 1, 1.1, 1.1.1 — vazio no orcamento rapido */
  fase: string | null
  codigo_referencia: string | null
  base_referencia: BaseReferencia
  referencia_data_base?: string | null
  referencia_desonerado?: boolean | null
  descricao: string
  unidade: string | null
  quantidade: number | null
  /** interno */
  custo_material: Centavos | null
  /** interno */
  custo_mao_obra: Centavos | null
  /** quando informado, manda sobre o calculo por margem */
  preco_unitario: Centavos | null
  /** item "a cotar separadamente": aparece descrito, sem preco, e nao soma */
  terceirizado_sem_valor: boolean
  ordem: number
}

export interface ItemCalculado extends ItemOrcamento {
  /** material + mao de obra, por unidade — interno */
  custo_unitario: Centavos
  /** custo x quantidade — interno */
  custo_total: Centavos
  /** preco de venda unitario antes do BDI */
  preco_base_unitario: Centavos
  /** preco unitario como sai no documento, conforme o modo de BDI */
  preco_exibido_unitario: Centavos
  /** total do item como sai no documento */
  total: Centavos
  /** interno */
  margem_valor: Centavos
}

export interface ConfiguracaoOrcamento {
  /** fracao: 0,30 = 30% */
  margem: number
  /** fracao: 0,25 = 25% */
  bdi: number
  modo_bdi: ModoBdi
}

/**
 * Calcula um item. O preco base sai do preco unitario informado (caso do item
 * de base referencial, que ja vem com preco) ou do custo mais a margem.
 */
export function calcularItem(item: ItemOrcamento, cfg: ConfiguracaoOrcamento): ItemCalculado {
  const quantidade = item.quantidade ?? 0
  const custo_unitario = (item.custo_material ?? 0) + (item.custo_mao_obra ?? 0)
  const preco_base_unitario =
    item.preco_unitario ?? (custo_unitario > 0 ? aplicarFator(custo_unitario, 1 + cfg.margem) : 0)

  // No modo embutido o BDI entra dentro do preco unitario: existe, mas nao
  // aparece como linha no documento do cliente.
  const preco_exibido_unitario =
    cfg.modo_bdi === 'embutido' ? aplicarFator(preco_base_unitario, 1 + cfg.bdi) : preco_base_unitario

  // Item a cotar separadamente aparece descrito e nao soma no total.
  const total = item.terceirizado_sem_valor ? 0 : Math.round(quantidade * preco_exibido_unitario)
  const custo_total = item.terceirizado_sem_valor ? 0 : Math.round(quantidade * custo_unitario)

  return {
    ...item,
    custo_unitario,
    custo_total,
    preco_base_unitario,
    preco_exibido_unitario,
    total,
    margem_valor: item.terceirizado_sem_valor
      ? 0
      : Math.round(quantidade * preco_base_unitario) - custo_total,
  }
}

export interface FaseOrcamento {
  /** '1', '1.1', '1.1.1' */
  fase: string
  /** 1 para '1', 2 para '1.1', 3 para '1.1.1' */
  nivel: number
  descricao: string
  itens: ItemCalculado[]
  /** soma dos itens da fase e de todas as subfases */
  subtotal: Centavos
  custo: Centavos
  /** quantos itens a cotar separadamente ha na fase */
  itens_sem_valor: number
}

export interface TotaisOrcamento {
  /** soma dos itens, como saem no documento */
  subtotal: Centavos
  /** linha de BDI, apenas no modo visivel */
  valor_bdi: Centavos
  /** o que o cliente paga */
  total: Centavos
  /** interno */
  custo_total: Centavos
  /** interno: total - custo */
  margem_valor: Centavos
  margem_percentual: number
  itens_sem_valor: number
}

export interface OrcamentoCalculado {
  itens: ItemCalculado[]
  fases: FaseOrcamento[]
  totais: TotaisOrcamento
  configuracao: ConfiguracaoOrcamento
}

export function calcularOrcamento(
  itens: ItemOrcamento[],
  cfg: ConfiguracaoOrcamento,
): OrcamentoCalculado {
  const calculados = itens.map((i) => calcularItem(i, cfg))

  // O subtotal e sempre a soma das linhas: o que o cliente confere na mao bate
  // com o que esta impresso.
  const subtotal = calculados.reduce((s, i) => s + i.total, 0)

  // So o modo visivel mostra o BDI como linha; no embutido ele ja esta dentro
  // dos precos unitarios, e no sem_bdi nao existe.
  const valor_bdi = cfg.modo_bdi === 'visivel' ? aplicarFator(subtotal, cfg.bdi) : 0
  const total = subtotal + valor_bdi
  const custo_total = calculados.reduce((s, i) => s + i.custo_total, 0)

  return {
    itens: calculados,
    fases: montarFases(calculados),
    configuracao: cfg,
    totais: {
      subtotal,
      valor_bdi,
      total,
      custo_total,
      margem_valor: total - custo_total,
      margem_percentual: total > 0 ? (total - custo_total) / total : 0,
      itens_sem_valor: calculados.filter((i) => i.terceirizado_sem_valor).length,
    },
  }
}

/**
 * Monta a hierarquia de fases. O subtotal de '1' inclui '1.1' e '1.1.1' — e o
 * que se espera de um orcamento executivo com varias fases.
 */
export function montarFases(itens: ItemCalculado[]): FaseOrcamento[] {
  const comFase = itens.filter((i) => i.fase)
  if (comFase.length === 0) return []

  const chaves = [...new Set(comFase.map((i) => i.fase as string))]
  const todas = new Set<string>()
  // garante que a fase-mae exista mesmo que so as filhas tenham item
  for (const chave of chaves) {
    const partes = chave.split('.')
    for (let i = 1; i <= partes.length; i++) todas.add(partes.slice(0, i).join('.'))
  }

  const descricaoDaFase = new Map<string, string>()
  for (const item of comFase) {
    if (!descricaoDaFase.has(item.fase as string)) {
      descricaoDaFase.set(item.fase as string, item.descricao)
    }
  }

  return [...todas]
    .sort(compararFases)
    .map((fase) => {
      const proprios = comFase.filter((i) => i.fase === fase)
      const descendentes = comFase.filter((i) => (i.fase as string).startsWith(`${fase}.`))
      const todosOsItens = [...proprios, ...descendentes]

      return {
        fase,
        nivel: fase.split('.').length,
        descricao: descricaoDaFase.get(fase) ?? '',
        itens: [...proprios].sort((a, b) => a.ordem - b.ordem),
        subtotal: todosOsItens.reduce((s, i) => s + i.total, 0),
        custo: todosOsItens.reduce((s, i) => s + i.custo_total, 0),
        itens_sem_valor: todosOsItens.filter((i) => i.terceirizado_sem_valor).length,
      }
    })
}

/** Ordena 1, 1.1, 1.2, 1.10, 2 — comparando numero a numero, nunca como texto. */
export function compararFases(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? -1
    const vb = pb[i] ?? -1
    if (va !== vb) return va - vb
  }
  return 0
}

/**
 * Custo por unidade do servico (spec 6.2): a partir do custo total apurado e da
 * quantidade, com o preco de venda sugerido pela margem.
 */
export function custoPorUnidade(
  custoTotal: Centavos,
  quantidade: number,
  margem: number,
): { custo_unitario: Centavos; preco_sugerido: Centavos } {
  if (quantidade <= 0) return { custo_unitario: 0, preco_sugerido: 0 }
  const custo_unitario = Math.round(custoTotal / quantidade)
  return { custo_unitario, preco_sugerido: aplicarFator(custo_unitario, 1 + margem) }
}

export const ROTULO_MODO_BDI: Record<ModoBdi, string> = {
  visivel: 'BDI visível como linha (versão interna)',
  embutido: 'BDI embutido no preço unitário (versão do cliente)',
  sem_bdi: 'Sem BDI',
}

/**
 * Como a tabela de referencia aparece no documento do cliente.
 *
 * "SINAPI 88489" sozinho nao permite conferir nada: o mesmo codigo tem preco
 * diferente a cada mes, e diferente ainda entre a versao desonerada e a nao
 * desonerada. O documento precisa dizer qual das duas, de qual mes.
 */
export function rotuloDaReferencia(r: {
  base: string
  data_base?: string | null
  desonerado?: boolean | null
}): string {
  const partes = [r.base]

  if (r.data_base) {
    // data de calendario e texto aaaa-mm-dd: virar Date aqui devolveria o mes
    // anterior em qualquer fuso a oeste de Greenwich.
    const [ano, mes] = r.data_base.split('-')
    if (ano && mes) partes.push(`${mes}/${ano}`)
  }

  if (r.desonerado === true) partes.push('desonerada')
  else if (r.desonerado === false) partes.push('nao desonerada')

  return partes.join(' · ')
}

/** As tabelas de referencia efetivamente usadas por um orcamento, sem repetir. */
export function referenciasUsadas(
  itens: {
    base_referencia: BaseReferencia
    referencia_data_base?: string | null
    referencia_desonerado?: boolean | null
  }[],
): string[] {
  const vistas = new Set<string>()
  for (const item of itens) {
    if (item.base_referencia === 'proprio') continue
    vistas.add(
      rotuloDaReferencia({
        base: item.base_referencia,
        data_base: item.referencia_data_base ?? null,
        desonerado: item.referencia_desonerado ?? null,
      }),
    )
  }
  return [...vistas].sort()
}
