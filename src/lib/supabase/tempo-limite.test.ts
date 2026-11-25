import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchComLimite } from './tempo-limite'

afterEach(() => vi.unstubAllGlobals())

describe('fetchComLimite — banco que nao responde nao prende o app', () => {
  it('desiste depois do limite e marca a falha', async () => {
    // Imita o Supabase pausado: a requisicao nunca termina, so cai pelo abort.
    vi.stubGlobal('fetch', (_: unknown, init?: RequestInit) =>
      new Promise((_r, rejeitar) => init?.signal?.addEventListener('abort', () => rejeitar(init.signal!.reason))),
    )
    const rede = fetchComLimite(50)
    const inicio = Date.now()
    await expect(rede.fetch('https://banco.exemplo')).rejects.toThrow()
    expect(Date.now() - inicio).toBeLessThan(1000)
    expect(rede.falhou()).toBe(true)
  })

  it('resposta de erro HTTP nao conta como banco fora do ar', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 401 }))
    const rede = fetchComLimite(1000)
    const r = await rede.fetch('https://banco.exemplo')
    expect(r.status).toBe(401)
    expect(rede.falhou()).toBe(false)
  })

  it('respeita o cancelamento de quem chamou', async () => {
    vi.stubGlobal('fetch', (_: unknown, init?: RequestInit) =>
      new Promise((_r, rejeitar) => init?.signal?.addEventListener('abort', () => rejeitar(init.signal!.reason))),
    )
    const rede = fetchComLimite(10_000)
    const ctrl = new AbortController()
    const p = rede.fetch('https://banco.exemplo', { signal: ctrl.signal })
    ctrl.abort()
    await expect(p).rejects.toBeDefined()
  })
})

describe('fetchComLimite — sessao vencida nao multiplica a espera', () => {
  it('depois da primeira falha, as tentativas seguintes desistem na hora', async () => {
    let chamadas = 0
    vi.stubGlobal('fetch', (_: unknown, init?: RequestInit) => {
      chamadas++
      return new Promise((_r, rejeitar) => init?.signal?.addEventListener('abort', () => rejeitar(init.signal!.reason)))
    })
    const rede = fetchComLimite(50)
    await expect(rede.fetch('https://banco.exemplo')).rejects.toThrow()
    const inicio = Date.now()
    await expect(rede.fetch('https://banco.exemplo')).rejects.toThrow()
    await expect(rede.fetch('https://banco.exemplo')).rejects.toThrow()
    expect(Date.now() - inicio).toBeLessThan(20)
    expect(chamadas).toBe(1)
  })
})
