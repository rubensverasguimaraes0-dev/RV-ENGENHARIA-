import 'server-only'

/**
 * A logo da empresa no topo das planilhas (spec 11.3: todo documento de
 * cliente sai com a logo). Ela mora numa URL do bucket `publico`, entao
 * precisa ser baixada no servidor e embutida no xlsx.
 *
 * Nada aqui pode derrubar a geracao da planilha: se a logo nao vier, a
 * planilha sai igual a hoje, com a faixa azul e o nome da empresa.
 */

/** Formatos que o ExcelJS aceita embutir e que o navegador exporta. */
export type FormatoImagem = 'png' | 'jpeg' | 'gif'

export interface LogoPlanilha {
  dados: Buffer
  formato: FormatoImagem
  largura: number
  altura: number
  /** Id devolvido pelo workbook na primeira vez — para nao repetir a imagem em cada aba. */
  idNoWorkbook?: number
}

/** Teto do arquivo baixado. Uma logo de topo nao passa nem perto disso. */
const LIMITE_BYTES = 2 * 1024 * 1024
const SEGUNDOS_DE_ESPERA = 5

/**
 * Le largura e altura direto dos bytes, sem depender de biblioteca de imagem.
 * Sem as medidas reais a logo sairia esticada — e uma logo torta num
 * documento de cliente e pior do que logo nenhuma.
 */
export function medirImagem(bytes: Uint8Array): Omit<LogoPlanilha, 'dados' | 'idNoWorkbook'> | null {
  // Leitura defensiva: fora do arquivo devolve 0, nunca undefined.
  const b = (i: number): number => bytes[i] ?? 0

  // PNG: assinatura de 8 bytes, depois o bloco IHDR com largura e altura em big-endian.
  if (bytes.length > 24 && b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) {
    const inteiro = (i: number) =>
      ((b(i) << 24) | (b(i + 1) << 16) | (b(i + 2) << 8) | b(i + 3)) >>> 0
    return { formato: 'png', largura: inteiro(16), altura: inteiro(20) }
  }

  // GIF: "GIF87a"/"GIF89a", depois largura e altura em little-endian.
  if (bytes.length > 10 && b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46) {
    return { formato: 'gif', largura: b(6) | (b(7) << 8), altura: b(8) | (b(9) << 8) }
  }

  // JPEG: percorre os marcadores ate um SOF, que carrega as medidas.
  if (bytes.length > 4 && b(0) === 0xff && b(1) === 0xd8) {
    let i = 2
    while (i + 9 < bytes.length) {
      if (b(i) !== 0xff) { i++; continue }
      const marcador = b(i + 1)
      // SOF0..SOF15, menos os marcadores que nao descrevem quadro.
      const ehSOF =
        marcador >= 0xc0 && marcador <= 0xcf &&
        marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc
      if (ehSOF) {
        return {
          formato: 'jpeg',
          largura: (b(i + 7) << 8) | b(i + 8),
          altura: (b(i + 5) << 8) | b(i + 6),
        }
      }
      const tamanho = (b(i + 2) << 8) | b(i + 3)
      if (tamanho < 2) return null
      i += 2 + tamanho
    }
  }

  return null
}

/**
 * Le a logo que acompanha o app, de `public/`. E o caminho usado enquanto
 * ninguem tiver configurado uma logo propria — o xlsx nao pode buscar um
 * endereco relativo pela rede, entao vai direto ao arquivo.
 *
 * O next.config declara este arquivo em outputFileTracingIncludes, para ele
 * viajar junto com a funcao de servidor na Vercel.
 */
async function lerLogoEmbutida(): Promise<LogoPlanilha | null> {
  try {
    const { readFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const bytes = new Uint8Array(await readFile(join(process.cwd(), 'public', 'logo-rv.png')))
    const medida = medirImagem(bytes)
    if (!medida) return null
    return { ...medida, dados: Buffer.from(bytes) }
  } catch {
    return null
  }
}

/** Baixa a logo de um endereco https. Null em qualquer tropeco. */
async function baixarLogo(endereco: string): Promise<LogoPlanilha | null> {
  let alvo: URL
  try {
    alvo = new URL(endereco)
  } catch {
    return null
  }
  // So https: a logo vem do bucket publico do Supabase.
  if (alvo.protocol !== 'https:') return null

  try {
    const resposta = await fetch(alvo, {
      signal: AbortSignal.timeout(SEGUNDOS_DE_ESPERA * 1000),
      cache: 'no-store',
    })
    if (!resposta.ok) return null

    const declarado = Number(resposta.headers.get('content-length') ?? '0')
    if (declarado > LIMITE_BYTES) return null

    const bytes = new Uint8Array(await resposta.arrayBuffer())
    if (bytes.length === 0 || bytes.length > LIMITE_BYTES) return null

    const medida = medirImagem(bytes)
    if (!medida || medida.largura <= 0 || medida.altura <= 0) return null

    return { ...medida, dados: Buffer.from(bytes) }
  } catch {
    return null
  }
}

/**
 * Traz a logo para o cabecalho da planilha.
 *
 * Endereco vazio ou relativo e a logo que veio com o app. Um endereco https
 * que nao responda, ou que devolva algo que nao e imagem, tambem cai nela:
 * um documento de cliente com a marca certa vale mais do que um documento
 * sem marca nenhuma. Nada aqui derruba a geracao da planilha.
 */
export async function buscarLogo(url: string): Promise<LogoPlanilha | null> {
  const endereco = url.trim()
  if (!endereco || endereco.startsWith('/')) return lerLogoEmbutida()
  return (await baixarLogo(endereco)) ?? lerLogoEmbutida()
}

/** Altura da logo na faixa do cabecalho, em pixels. */
export const ALTURA_NA_FAIXA = 38
/** Teto de largura, para uma logo muito deitada nao empurrar o titulo. */
export const LARGURA_MAXIMA = 150

/** Medidas da logo desenhada no cabecalho, mantendo a proporcao original. */
export function medidasNaFaixa(logo: LogoPlanilha): { largura: number; altura: number } {
  const proporcao = logo.largura / logo.altura
  let altura = ALTURA_NA_FAIXA
  let largura = Math.round(altura * proporcao)
  if (largura > LARGURA_MAXIMA) {
    largura = LARGURA_MAXIMA
    altura = Math.round(largura / proporcao)
  }
  return { largura, altura }
}

/**
 * Quanto o titulo precisa recuar para nao ficar embaixo da logo.
 * O recuo do Excel e contado em caracteres; ~7px cada, na fonte padrao.
 */
export function recuoDoTitulo(logo: LogoPlanilha): number {
  return Math.ceil(medidasNaFaixa(logo).largura / 7) + 1
}
