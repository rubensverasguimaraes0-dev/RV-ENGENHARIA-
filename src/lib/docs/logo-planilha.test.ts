import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ALTURA_NA_FAIXA,
  LARGURA_MAXIMA,
  buscarLogo,
  medidasNaFaixa,
  medirImagem,
  recuoDoTitulo,
  type LogoPlanilha,
} from './logo-planilha'

/** PNG minimo: assinatura + IHDR com as medidas pedidas. */
export function pngFalso(largura: number, altura: number): Uint8Array {
  const b = new Uint8Array(30)
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  b.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8) // tamanho + "IHDR"
  const grande = (v: number, i: number) => {
    b[i] = (v >>> 24) & 0xff
    b[i + 1] = (v >>> 16) & 0xff
    b[i + 2] = (v >>> 8) & 0xff
    b[i + 3] = v & 0xff
  }
  grande(largura, 16)
  grande(altura, 20)
  return b
}

function jpegFalso(largura: number, altura: number): Uint8Array {
  // SOI + APP0 curto + SOF0 com as medidas + EOI
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (altura >> 8) & 0xff, altura & 0xff,
    (largura >> 8) & 0xff, largura & 0xff,
    0x03,
    0xff, 0xd9,
  ])
}

function gifFalso(largura: number, altura: number): Uint8Array {
  return new Uint8Array([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61,
    largura & 0xff, (largura >> 8) & 0xff,
    altura & 0xff, (altura >> 8) & 0xff,
    0x00, 0x00,
  ])
}

describe('medirImagem — le as medidas sem biblioteca de imagem', () => {
  it('le PNG', () => {
    expect(medirImagem(pngFalso(600, 200))).toEqual({ formato: 'png', largura: 600, altura: 200 })
  })

  it('le JPEG', () => {
    expect(medirImagem(jpegFalso(320, 240))).toEqual({ formato: 'jpeg', largura: 320, altura: 240 })
  })

  it('le GIF', () => {
    expect(medirImagem(gifFalso(48, 48))).toEqual({ formato: 'gif', largura: 48, altura: 48 })
  })

  it('devolve null para bytes que nao sao imagem, sem estourar', () => {
    expect(medirImagem(new Uint8Array([1, 2, 3]))).toBeNull()
    expect(medirImagem(new Uint8Array(0))).toBeNull()
    expect(medirImagem(new TextEncoder().encode('<html>nao sou imagem</html>'))).toBeNull()
  })

  it('nao entra em laco infinito num JPEG truncado', () => {
    const truncado = jpegFalso(100, 100).slice(0, 9)
    expect(medirImagem(truncado)).toBeNull()
  })
})

describe('medidas da logo na faixa do cabecalho', () => {
  const comMedidas = (largura: number, altura: number): LogoPlanilha => ({
    dados: Buffer.from(pngFalso(largura, altura)),
    formato: 'png',
    largura,
    altura,
  })

  it('mantem a proporcao ao encaixar na altura da faixa', () => {
    const { largura, altura } = medidasNaFaixa(comMedidas(200, 100))
    expect(altura).toBe(ALTURA_NA_FAIXA)
    expect(largura).toBe(ALTURA_NA_FAIXA * 2)
  })

  it('respeita o teto de largura numa logo muito deitada, sem esticar', () => {
    const original = comMedidas(1000, 100)
    const { largura, altura } = medidasNaFaixa(original)
    expect(largura).toBe(LARGURA_MAXIMA)
    expect(altura).toBeLessThan(ALTURA_NA_FAIXA)
    // proporcao preservada dentro do arredondamento de um pixel
    expect(Math.abs(largura / altura - original.largura / original.altura)).toBeLessThan(0.6)
  })

  it('logo mais larga pede mais recuo do titulo', () => {
    expect(recuoDoTitulo(comMedidas(400, 100))).toBeGreaterThan(recuoDoTitulo(comMedidas(100, 100)))
  })
})

describe('buscarLogo — nunca derruba a geracao da planilha', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  const responder = (corpo: Uint8Array, init: { ok?: boolean; tamanho?: string } = {}) =>
    vi.fn(async () => ({
      ok: init.ok ?? true,
      headers: { get: () => init.tamanho ?? String(corpo.length) },
      arrayBuffer: async () => corpo.buffer.slice(corpo.byteOffset, corpo.byteOffset + corpo.byteLength),
    }))

  it('devolve null quando nao ha logo configurada, sem nem tentar buscar', async () => {
    const buscar = responder(pngFalso(10, 10))
    vi.stubGlobal('fetch', buscar)
    expect(await buscarLogo('')).toBeNull()
    expect(await buscarLogo('   ')).toBeNull()
    expect(buscar).not.toHaveBeenCalled()
  })

  it('recusa endereco invalido e fora do https', async () => {
    const buscar = responder(pngFalso(10, 10))
    vi.stubGlobal('fetch', buscar)
    expect(await buscarLogo('isto nao e uma url')).toBeNull()
    expect(await buscarLogo('http://exemplo.com/logo.png')).toBeNull()
    expect(await buscarLogo('file:///etc/passwd')).toBeNull()
    expect(buscar).not.toHaveBeenCalled()
  })

  it('traz a logo quando o servidor responde uma imagem', async () => {
    vi.stubGlobal('fetch', responder(pngFalso(240, 80)))
    const logo = await buscarLogo('https://projeto.supabase.co/storage/v1/object/publico/logo.png')
    expect(logo).not.toBeNull()
    expect(logo?.formato).toBe('png')
    expect(logo?.largura).toBe(240)
    expect(logo?.altura).toBe(80)
  })

  it('devolve null quando o servidor erra, quando o arquivo e grande demais e quando a rede cai', async () => {
    vi.stubGlobal('fetch', responder(pngFalso(10, 10), { ok: false }))
    expect(await buscarLogo('https://exemplo.com/logo.png')).toBeNull()

    vi.stubGlobal('fetch', responder(pngFalso(10, 10), { tamanho: String(50 * 1024 * 1024) }))
    expect(await buscarLogo('https://exemplo.com/logo.png')).toBeNull()

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('rede fora') }))
    expect(await buscarLogo('https://exemplo.com/logo.png')).toBeNull()
  })

  it('devolve null quando o que volta nao e imagem', async () => {
    vi.stubGlobal('fetch', responder(new TextEncoder().encode('<html>erro 404</html>')))
    expect(await buscarLogo('https://exemplo.com/logo.png')).toBeNull()
  })
})
