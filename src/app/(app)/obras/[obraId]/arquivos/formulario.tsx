'use client'

import { useState } from 'react'
import { FormularioAcao, Campo, Selecao } from '@/components/formulario'
import { CapturaFoto } from '@/components/captura-foto'
import { salvarArquivo } from './acoes'
import { hojeISO } from '@/lib/format'

const TIPOS = [
  'projeto',
  'prancha',
  'contrato',
  'cartão CNPJ',
  'conta de energia',
  'orçamento recebido',
  'foto da obra',
  'outro',
]

export function FormularioArquivo({
  obraId,
  clienteId,
}: {
  obraId: string
  clienteId: string | null
}) {
  const [galeria, setGaleria] = useState(false)

  return (
    <FormularioAcao acao={salvarArquivo} className="space-y-2" rotuloBotao="Guardar arquivo">
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="cliente_id" value={clienteId ?? ''} />

      <CapturaFoto
        bucket="arquivos"
        obraId={obraId}
        pasta="recebidos"
        nomeCampo="arquivo"
        rotulo="Escolher arquivo ou fotografar"
      />

      <Selecao
        rotulo="Tipo"
        nome="tipo"
        valor="projeto"
        opcoes={TIPOS.map((t) => ({ valor: t, rotulo: t }))}
      />
      <Campo rotulo="Descrição" nome="descricao" placeholder="Prancha de elétrica — rev. 02" />
      <Campo rotulo="Data" nome="data" tipo="date" valor={hojeISO()} />

      <label className="flex items-start gap-2 py-1">
        <input
          type="checkbox"
          name="galeria"
          className="mt-1 h-4 w-4"
          checked={galeria}
          onChange={(e) => setGaleria(e.target.checked)}
        />
        <span>
          <span className="text-sm font-medium">É foto da obra (entra na galeria)</span>
          <span className="block text-[11px] text-slate-500">
            A galeria permite baixar em alta para divulgação.
          </span>
        </span>
      </label>

      {galeria && (
        <Selecao
          rotulo="Momento"
          nome="momento"
          vazio="— sem marcação —"
          opcoes={[
            { valor: 'antes', rotulo: 'Antes' },
            { valor: 'depois', rotulo: 'Depois' },
          ]}
        />
      )}
    </FormularioAcao>
  )
}
