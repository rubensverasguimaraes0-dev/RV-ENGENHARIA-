import 'server-only'
import { criarClienteServidor } from '@/lib/supabase/server'
import type { DataISO } from '@/lib/format'

export interface ArquivoComUrl {
  id: string
  obra_id: string | null
  cliente_id: string | null
  tipo: string | null
  descricao: string | null
  data: DataISO | null
  arquivo_url: string
  url: string | null
  galeria: boolean
  momento: string | null
  imagem: boolean
}

const EXTENSOES_IMAGEM = ['.jpg', '.jpeg', '.png', '.webp', '.heic']

/**
 * Arquivos da obra com URL assinada. O bucket e privado: cada listagem assina
 * os caminhos por uma hora.
 */
export async function listarArquivos(obraId: string): Promise<ArquivoComUrl[]> {
  const supabase = await criarClienteServidor()

  const { data } = await supabase
    .from('arquivos')
    .select('id, obra_id, cliente_id, tipo, descricao, data, arquivo_url, galeria, momento')
    .eq('obra_id', obraId)
    .is('excluido_em', null)
    .order('data', { ascending: false })

  const linhas = (data ?? []) as Omit<ArquivoComUrl, 'url' | 'imagem'>[]
  const caminhos = linhas.map((a) => a.arquivo_url).filter((c) => !c.startsWith('http'))

  const assinadas = new Map<string, string>()
  if (caminhos.length > 0) {
    const { data: urls } = await supabase.storage
      .from('arquivos')
      .createSignedUrls([...new Set(caminhos)], 3600)
    for (const u of urls ?? []) {
      if (u.signedUrl && u.path) assinadas.set(u.path, u.signedUrl)
    }
  }

  return linhas.map((a) => ({
    ...a,
    url: a.arquivo_url.startsWith('http') ? a.arquivo_url : assinadas.get(a.arquivo_url) ?? null,
    imagem: EXTENSOES_IMAGEM.some((e) => a.arquivo_url.toLowerCase().endsWith(e)),
  }))
}
