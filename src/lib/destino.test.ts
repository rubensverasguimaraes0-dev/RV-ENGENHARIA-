import { describe, expect, it } from 'vitest'
import { destinoSeguro } from './destino'

describe('destino do link de e-mail', () => {
  const padrao = '/nova-senha'

  it('aceita caminho do proprio app', () => {
    expect(destinoSeguro('/obras', padrao)).toBe('/obras')
    expect(destinoSeguro('/nova-senha', padrao)).toBe('/nova-senha')
  })

  it('recusa endereco de outro site', () => {
    expect(destinoSeguro('https://site-falso.com', padrao)).toBe(padrao)
    expect(destinoSeguro('http://site-falso.com', padrao)).toBe(padrao)
  })

  it('recusa a barra dupla, que o navegador le como outro site', () => {
    expect(destinoSeguro('//site-falso.com', padrao)).toBe(padrao)
  })

  it('recusa a barra com contrabarra, que alguns navegadores tambem leem como outro site', () => {
    expect(destinoSeguro('/\\site-falso.com', padrao)).toBe(padrao)
  })

  it('sem destino, usa o padrao', () => {
    expect(destinoSeguro(null, padrao)).toBe(padrao)
    expect(destinoSeguro('', padrao)).toBe(padrao)
  })
})
