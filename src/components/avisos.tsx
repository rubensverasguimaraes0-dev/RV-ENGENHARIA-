'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/**
 * Avisos de retorno das acoes ("Lancado.", "Semana fechada.").
 *
 * Em obra, com sol na tela e o celular na mao, um texto pequeno ao lado do
 * botao passa despercebido — e a pessoa toca de novo achando que nao gravou.
 * O aviso aparece no rodape, ocupa a largura da tela e some sozinho.
 *
 * A regiao tem aria-live: quem usa leitor de tela ouve o retorno sem precisar
 * procurar onde ele apareceu.
 */
export interface Aviso {
  id: number
  texto: string
  tom: 'ok' | 'erro'
}

interface Contexto {
  avisar: (texto: string, tom?: 'ok' | 'erro') => void
}

const ContextoAvisos = createContext<Contexto>({ avisar: () => {} })

export function useAvisos() {
  return useContext(ContextoAvisos)
}

export function ProvedorDeAvisos({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])

  const avisar = useCallback((texto: string, tom: 'ok' | 'erro' = 'ok') => {
    const id = Date.now() + Math.random()
    setAvisos((atuais) => [...atuais, { id, texto, tom }])
  }, [])

  return (
    <ContextoAvisos.Provider value={{ avisar }}>
      {children}
      <div className="avisos nao-imprimir" role="status" aria-live="polite">
        {avisos.map((aviso) => (
          <Balao
            key={aviso.id}
            aviso={aviso}
            aoSumir={() => setAvisos((atuais) => atuais.filter((a) => a.id !== aviso.id))}
          />
        ))}
      </div>
    </ContextoAvisos.Provider>
  )
}

function Balao({ aviso, aoSumir }: { aviso: Aviso; aoSumir: () => void }) {
  useEffect(() => {
    // O erro fica mais tempo: normalmente exige uma acao de quem esta lendo.
    const prazo = aviso.tom === 'erro' ? 7000 : 3200
    const relogio = setTimeout(aoSumir, prazo)
    return () => clearTimeout(relogio)
  }, [aviso.tom, aoSumir])

  return (
    <div className={`aviso-balao aviso-${aviso.tom}`}>
      <span aria-hidden="true" className="aviso-marca">
        {aviso.tom === 'ok' ? '✓' : '!'}
      </span>
      <span className="flex-1">{aviso.texto}</span>
      <button type="button" onClick={aoSumir} aria-label="Fechar aviso" className="aviso-fechar">
        ×
      </button>
    </div>
  )
}
