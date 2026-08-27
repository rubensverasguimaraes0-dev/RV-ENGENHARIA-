'use client'

import { FormularioAcao } from '@/components/formulario'
import { fecharSemana } from '../acoes'
import { diasDaSemana, formatarData, nomeDoDia } from '@/lib/format'

export function FormularioFechamento({
  obraId,
  semanaId,
  dataInicio,
  diasSemExpediente,
}: {
  obraId: string
  semanaId: string
  dataInicio: string
  diasSemExpediente: string[]
}) {
  const dias = diasDaSemana(dataInicio)

  return (
    <FormularioAcao acao={fecharSemana} rotuloBotao="Fechar a semana">
      <input type="hidden" name="semana_id" value={semanaId} />
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="data_inicio" value={dataInicio} />

      <p className="text-sm text-slate-600 mb-2">
        Marque os dias em que não houve expediente. Eles não entram no relatório — é o caso da
        semana encerrada na quinta ou na sexta.
      </p>

      <ul className="space-y-1">
        {dias.map((d) => (
          <li key={d}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={`sem_expediente_${d}`}
                defaultChecked={diasSemExpediente.includes(d)}
                className="h-4 w-4"
              />
              <span>
                {nomeDoDia(d)}, {formatarData(d)}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </FormularioAcao>
  )
}
