'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A mescla entre o que a pessoa digitou e o que a IA leu da foto.
 *
 * Os formularios do app usam campos nao-controlados (defaultValue). Quando a
 * leitura chega, a secao renasce com uma `key` nova e os campos voltam a nascer
 * com o valor mesclado. Duas armadilhas moram aqui, e as duas ja morderam:
 *
 *  1. Ler o que esta na tela ANTES do `await` perde tudo o que for digitado
 *     durante a leitura — que leva segundos, com os campos ainda editaveis.
 *     Por isso `aplicar` le a tela DEPOIS da resposta, nunca antes.
 *
 *  2. Deduzir "a pessoa mexeu aqui" comparando com o valor inicial erra nos
 *     dois sentidos: depois da primeira leitura, valor lido fica identico a
 *     valor digitado; e quem corrige um campo DE VOLTA para o padrao (trocar
 *     a ligacao de volta para Monofasica) parecia nao ter mexido, e a leitura
 *     seguinte atropelava a correcao. Aqui "mexeu" e registrado por EVENTO, no
 *     proprio formulario, e nao inferido.
 *
 * Regra final: campo que a pessoa tocou fica como ela deixou; o resto recebe o
 * que a leitura trouxe; sem leitura para o campo, volta ao padrao.
 */
export function useMesclaDaLeitura<N extends string>(iniciais: Record<N, string>) {
  const nomes = Object.keys(iniciais) as N[]
  const [valores, setValores] = useState<Record<N, string>>(iniciais)
  const [versao, setVersao] = useState(0)

  // Ancora em qualquer ponto do formulario: serve para achar o <form> e, por
  // ele, todos os campos — inclusive os de secoes que remontam.
  const ancoraRef = useRef<HTMLDivElement>(null)
  const tocados = useRef<Set<string>>(new Set())

  useEffect(() => {
    const form = ancoraRef.current?.closest('form')
    if (!form) return
    const anotar = (e: Event) => {
      const alvo = e.target as { name?: string } | null
      if (alvo?.name) tocados.current.add(alvo.name)
    }
    // O ouvinte fica no <form>, que nao remonta: campo que renasce continua
    // sendo escutado.
    form.addEventListener('input', anotar)
    form.addEventListener('change', anotar)
    return () => {
      form.removeEventListener('input', anotar)
      form.removeEventListener('change', anotar)
    }
  }, [])

  const aplicar = useCallback(
    (lidos: Partial<Record<N, string | null>>) => {
      const form = ancoraRef.current?.closest('form')
      const mesclados = { ...iniciais }

      for (const nome of nomes) {
        if (tocados.current.has(nome)) {
          // O que a pessoa deixou na tela AGORA — lido depois da resposta.
          const campo = form?.querySelector<HTMLInputElement | HTMLSelectElement>(
            `[name="${nome}"]`,
          )
          mesclados[nome] = campo?.value ?? iniciais[nome]
        } else {
          mesclados[nome] = lidos[nome] ?? iniciais[nome]
        }
      }

      setValores(mesclados)
      setVersao((v) => v + 1)
    },
    // `iniciais` e `nomes` sao constantes do modulo em ambos os usos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return { valores, versao, ancoraRef, aplicar }
}
