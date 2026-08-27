'use client'

export function BotaoImprimir({ rotulo = 'Imprimir / salvar PDF' }: { rotulo?: string }) {
  return (
    <button type="button" className="botao botao-neutro" onClick={() => window.print()}>
      {rotulo}
    </button>
  )
}
