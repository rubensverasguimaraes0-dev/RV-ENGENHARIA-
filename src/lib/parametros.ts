import { cache } from 'react'
import { criarClienteServidor } from '@/lib/supabase/server'
import type { Centavos } from '@/lib/format'

/**
 * Leitura dos parametros do app (spec 11.6: nenhum valor de referencia fica
 * fixo no codigo). Os padroes abaixo sao apenas rede de seguranca para um banco
 * ainda sem carga — o valor que vale e o da tabela.
 */
const PADROES: Record<string, string> = {
  empresa_nome: 'RV Engenharia',
  empresa_endereco: 'Av. Zequinha Freire, 3531 — Teresina/PI',
  empresa_telefone: '(86) 99437-9883',
  empresa_email: 'rvengenhariathe@gmail.com',
  empresa_instagram: '@rvengenhariathe',
  empresa_logo_url: '',
  responsavel_nome: 'Rubens Veras Guimarães',
  responsavel_titulo: 'Eng. Civil',
  responsavel_crea: 'CREA-PI 35900',
  valor_quentinha_padrao: '1800',
  faixas_quentinha: '[1500,1800,2200]',
  percentual_meia_diaria: '0.5',
  percentual_rateio_parceiro: '0.5',
  base_rateio_parceiro: 'resultado_total',
  margem_padrao: '0.30',
  bdi_padrao: '0.25',
  solar_hsp: '5.4',
  solar_performance_ratio: '0.78',
  solar_disp_monofasica: '30',
  solar_disp_bifasica: '50',
  solar_disp_trifasica: '100',
  solar_degradacao_anual: '0.0055',
  solar_fator_inversor: '0.80',
  solar_tarifa_fio_b: '30',
  solar_margem: '0.30',
  cotacao_dias_alerta: '30',
}

export type MapaParametros = Record<string, string>

export async function carregarParametros(): Promise<MapaParametros> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('parametros').select('chave, valor')
  const mapa: MapaParametros = { ...PADROES }
  for (const p of data ?? []) mapa[p.chave as string] = p.valor as string
  return mapa
}

/**
 * Identidade da empresa — nome, contato, logo e responsavel tecnico.
 *
 * Le a view `identidade_visivel` em vez da tabela `parametros`, porque
 * `parametros` e so de administrador: guarda margem, BDI e meia diaria, que o
 * lancador nao pode ver (regra 11.1). Sem isso a logo apareceria no topo do
 * app para o administrador e sumiria para o lancador, no mesmo aplicativo.
 *
 * A view tambem e legivel pelo anonimo, para a tela de login se identificar
 * antes de haver sessao.
 *
 * `cache` deduplica a leitura dentro da mesma requisicao: o layout e a pagina
 * podem pedir a identidade a vontade, que o banco e consultado uma vez so.
 */
export const carregarIdentidade = cache(async (): Promise<MapaParametros> => {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('identidade_visivel').select('chave, valor')
  const mapa: MapaParametros = { ...PADROES }
  for (const p of data ?? []) mapa[p.chave as string] = p.valor as string
  return mapa
})

export function texto(p: MapaParametros, chave: string, padrao = ''): string {
  return p[chave] ?? PADROES[chave] ?? padrao
}

export function numero(p: MapaParametros, chave: string, padrao = 0): number {
  const v = Number(texto(p, chave, String(padrao)))
  return Number.isFinite(v) ? v : padrao
}

export function centavos(p: MapaParametros, chave: string, padrao: Centavos = 0): Centavos {
  return Math.round(numero(p, chave, padrao))
}

export function lista(p: MapaParametros, chave: string, padrao: number[] = []): number[] {
  try {
    const v = JSON.parse(texto(p, chave, '[]'))
    return Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : padrao
  } catch {
    return padrao
  }
}

export interface DadosEmpresa {
  nome: string
  endereco: string
  telefone: string
  email: string
  instagram: string
  logo_url: string
  responsavel: string
  responsavel_titulo: string
  crea: string
}

/** Cabecalho e rodape que acompanham todo documento de cliente (spec 4.17). */
export function dadosEmpresa(p: MapaParametros): DadosEmpresa {
  return {
    nome: texto(p, 'empresa_nome'),
    endereco: texto(p, 'empresa_endereco'),
    telefone: texto(p, 'empresa_telefone'),
    email: texto(p, 'empresa_email'),
    instagram: texto(p, 'empresa_instagram'),
    logo_url: texto(p, 'empresa_logo_url'),
    responsavel: texto(p, 'responsavel_nome'),
    responsavel_titulo: texto(p, 'responsavel_titulo'),
    crea: texto(p, 'responsavel_crea'),
  }
}
