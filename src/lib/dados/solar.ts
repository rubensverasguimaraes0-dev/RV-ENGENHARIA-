import 'server-only'
import { criarClienteServidor } from '@/lib/supabase/server'
import { carregarBaseDePrecos } from './cotacoes'
import { dimensionar, type Dimensionamento, type TipoLigacao } from '@/lib/domain/solar'
import {
  montarCotacaoSolar,
  type CategoriaSolar,
  type CotacaoSolar,
  type ParametrosProposta,
  type PrecoDeItem,
} from '@/lib/domain/proposta-solar'
import { carregarParametros, centavos, numero } from '@/lib/parametros'
import type { Centavos, DataISO } from '@/lib/format'

export interface ProjetoSolar {
  id: string
  cliente_id: string
  cliente_nome: string
  cliente_documento: string | null
  uc: string | null
  concessionaria: string | null
  tipo_ligacao: TipoLigacao
  tarifa: Centavos
  consumo_mensal: number[]
  tipo_telhado: string | null
  distancia_quadro: number | null
  anexo_conta_url: string | null
  potencia_kwp: number | null
  qtd_modulos: number | null
  modelo_modulo: string | null
  modelo_inversor: string | null
  custo_total: Centavos | null
  margem: number | null
  preco_venda: Centavos | null
  status: string
  criado_em: string
}

const CAMPOS =
  'id, cliente_id, uc, concessionaria, tipo_ligacao, tarifa, consumo_mensal_json, tipo_telhado, distancia_quadro, anexo_conta_url, potencia_kwp, qtd_modulos, modelo_modulo, modelo_inversor, custo_total, margem, preco_venda, status, criado_em, cliente:clientes (nome, documento)'

function normalizar(row: Record<string, unknown>): ProjetoSolar {
  const cliente = Array.isArray(row.cliente) ? row.cliente[0] : row.cliente
  const consumo = row.consumo_mensal_json
  return {
    id: row.id as string,
    cliente_id: row.cliente_id as string,
    cliente_nome: (cliente as { nome?: string } | null)?.nome ?? '—',
    cliente_documento: (cliente as { documento?: string } | null)?.documento ?? null,
    uc: (row.uc as string) ?? null,
    concessionaria: (row.concessionaria as string) ?? null,
    tipo_ligacao: (row.tipo_ligacao as TipoLigacao) ?? 'monofasica',
    tarifa: Number(row.tarifa ?? 0),
    consumo_mensal: Array.isArray(consumo) ? (consumo as number[]).map(Number) : [],
    tipo_telhado: (row.tipo_telhado as string) ?? null,
    distancia_quadro: row.distancia_quadro === null ? null : Number(row.distancia_quadro),
    anexo_conta_url: (row.anexo_conta_url as string) ?? null,
    potencia_kwp: row.potencia_kwp === null ? null : Number(row.potencia_kwp),
    qtd_modulos: row.qtd_modulos === null ? null : Number(row.qtd_modulos),
    modelo_modulo: (row.modelo_modulo as string) ?? null,
    modelo_inversor: (row.modelo_inversor as string) ?? null,
    custo_total: row.custo_total === null ? null : Number(row.custo_total),
    margem: row.margem === null ? null : Number(row.margem),
    preco_venda: row.preco_venda === null ? null : Number(row.preco_venda),
    status: (row.status as string) ?? 'rascunho',
    criado_em: row.criado_em as string,
  }
}

export async function listarProjetosSolar(): Promise<ProjetoSolar[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase
    .from('projetos_solar')
    .select(CAMPOS)
    .is('excluido_em', null)
    .order('criado_em', { ascending: false })
  return (data ?? []).map((p) => normalizar(p as Record<string, unknown>))
}

export interface ProjetoCompleto {
  projeto: ProjetoSolar
  dimensionamento: Dimensionamento
  cotacao: CotacaoSolar
  parametros: ParametrosProposta
  percentual_fio_b: number
  tarifa_fio_b: Centavos
  anexo_url: string | null
}

/** Mapeia as categorias da base de precos para os itens da cotacao solar. */
const CATEGORIAS: CategoriaSolar[] = [
  'modulo',
  'inversor',
  'estrutura',
  'cabo',
  'conector',
  'stringbox',
  'eletrico',
]

export async function carregarProjetoSolar(projetoId: string): Promise<ProjetoCompleto | null> {
  const supabase = await criarClienteServidor()

  const { data } = await supabase
    .from('projetos_solar')
    .select(CAMPOS)
    .eq('id', projetoId)
    .is('excluido_em', null)
    .maybeSingle()

  if (!data) return null
  const projeto = normalizar(data as Record<string, unknown>)
  const p = await carregarParametros()

  const dimensionamento = dimensionar({
    consumo_mensal: projeto.consumo_mensal,
    tipo_ligacao: projeto.tipo_ligacao,
    potencia_modulo_wp: numero(p, 'solar_potencia_modulo_wp', 610),
    area_modulo_m2: numero(p, 'solar_area_modulo_m2', 2.79),
    parametros: {
      hsp: numero(p, 'solar_hsp', 5.4),
      performance_ratio: numero(p, 'solar_performance_ratio', 0.78),
      custo_disponibilidade: {
        monofasica: numero(p, 'solar_disp_monofasica', 30),
        bifasica: numero(p, 'solar_disp_bifasica', 50),
        trifasica: numero(p, 'solar_disp_trifasica', 100),
      },
      degradacao_anual: numero(p, 'solar_degradacao_anual', 0.0055),
      fator_inversor: numero(p, 'solar_fator_inversor', 0.8),
    },
  })

  // Menor preco vigente de cada categoria, vindo da base compartilhada
  const base = await carregarBaseDePrecos()
  const precos: Partial<Record<CategoriaSolar, PrecoDeItem>> = {}

  for (const categoria of CATEGORIAS) {
    const candidatos = base.grupos.filter(
      (g) => (g.escolhido.categoria ?? '').toLowerCase() === categoria,
    )
    if (candidatos.length === 0) continue
    // dentro da categoria, o mais barato entre os escolhidos de cada produto
    const melhor = candidatos.reduce((a, b) =>
      a.escolhido.preco_unitario <= b.escolhido.preco_unitario ? a : b,
    )
    precos[categoria] = {
      descricao:
        [melhor.escolhido.marca, melhor.escolhido.modelo, melhor.escolhido.especificacao]
          .filter(Boolean)
          .join(' ') || categoria,
      preco_unitario: melhor.escolhido.preco_unitario,
      situacao: melhor.escolhido.situacao,
      fornecedor: melhor.escolhido.cotacao.fornecedor_nome,
    }
  }

  const parametros: ParametrosProposta = {
    projeto_art: centavos(p, 'solar_projeto_art', 150000),
    mao_obra_kwp: centavos(p, 'solar_mao_obra_kwp', 50000),
    margem: projeto.margem ?? numero(p, 'solar_margem', 0.3),
    distancia_quadro_m: projeto.distancia_quadro ?? 20,
    frete_percentual: numero(p, 'solar_frete_percentual', 0),
  }

  const ano = String(new Date().getFullYear())
  let percentual_fio_b = 0.6
  try {
    const tabela = JSON.parse(p.solar_percentual_fio_b ?? '{}') as Record<string, number>
    percentual_fio_b = Number(tabela[ano] ?? percentual_fio_b)
  } catch {
    // mantem o padrao
  }

  let anexo_url: string | null = null
  if (projeto.anexo_conta_url) {
    if (projeto.anexo_conta_url.startsWith('http')) {
      anexo_url = projeto.anexo_conta_url
    } else {
      const { data: assinada } = await supabase.storage
        .from('arquivos')
        .createSignedUrl(projeto.anexo_conta_url, 3600)
      anexo_url = assinada?.signedUrl ?? null
    }
  }

  return {
    projeto,
    dimensionamento,
    cotacao: montarCotacaoSolar({ dimensionamento, precos, parametros }),
    parametros,
    percentual_fio_b,
    tarifa_fio_b: centavos(p, 'solar_tarifa_fio_b', 30),
    anexo_url,
  }
}
