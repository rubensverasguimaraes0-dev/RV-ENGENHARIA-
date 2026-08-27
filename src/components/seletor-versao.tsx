'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  PREDEFINIDOS,
  ROTULOS_VERSAO,
  VERSAO_PADRAO,
  versaoParaQuery,
  type VersaoExibicao,
} from '@/lib/domain/versoes-exibicao'

/**
 * Seletor de versao do documento (spec 4.14). Cada opcao liga ou desliga um
 * bloco; a combinacao vai na URL do documento e fica salva junto com ele.
 */
export function SeletorVersao({
  href,
  versaoInicial = VERSAO_PADRAO,
  extra,
}: {
  href: string
  versaoInicial?: VersaoExibicao
  extra?: Record<string, string>
}) {
  const [versao, setVersao] = useState<VersaoExibicao>(versaoInicial)

  const query = [
    ...Object.entries(extra ?? {}).map(([k, v]) => `${k}=${encodeURIComponent(v)}`),
    versaoParaQuery(versao),
  ]
    .filter(Boolean)
    .join('&')

  const destino = query ? `${href}?${query}` : href
  const chaves = Object.keys(VERSAO_PADRAO) as (keyof VersaoExibicao)[]

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-3">
        {PREDEFINIDOS.map((p) => (
          <button
            key={p.nome}
            type="button"
            title={p.descricao}
            onClick={() => setVersao(p.versao)}
            className="px-2 py-1 rounded border border-slate-300 bg-white text-xs font-semibold text-rv-800 hover:bg-rv-50"
          >
            {p.nome}
          </button>
        ))}
      </div>

      <ul className="space-y-1">
        {chaves.map((chave) => {
          const info = ROTULOS_VERSAO[chave]
          const bloqueado = versao.versao_pedreiro && (chave === 'mostrar_preco_unitario' || chave === 'mostrar_bdi_margem')
          return (
            <li key={chave}>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={versao[chave]}
                  disabled={bloqueado}
                  onChange={(e) => {
                    const novo = { ...versao, [chave]: e.target.checked }
                    // a versao do pedreiro nao carrega valor nenhum
                    if (novo.versao_pedreiro) {
                      novo.mostrar_preco_unitario = false
                      novo.mostrar_bdi_margem = false
                    }
                    setVersao(novo)
                  }}
                />
                <span>
                  <span className={`text-sm font-medium ${bloqueado ? 'text-slate-400' : ''}`}>
                    {info.rotulo}
                  </span>
                  <span className="block text-[11px] text-slate-500">{info.dica}</span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {versao.mostrar_bdi_margem && (
        <p className="mt-2 text-xs rounded border border-erro-700/30 bg-erro-100 text-erro-700 px-2 py-1.5">
          Versão interna: mostra margem e BDI. Não envie este arquivo ao cliente.
        </p>
      )}

      <Link href={destino} className="botao botao-primario w-full mt-3">
        Gerar documento
      </Link>
    </div>
  )
}
