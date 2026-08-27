'use client'

import { FormularioAcao, Campo, Selecao } from '@/components/formulario'
import { importarPrecos } from './acoes'
import { hojeISO } from '@/lib/format'

export function FormularioImportacao() {
  return (
    <FormularioAcao acao={importarPrecos} className="space-y-2" rotuloBotao="Importar CSV">
      <Selecao
        rotulo="Base"
        nome="base"
        valor="SINAPI"
        opcoes={[
          { valor: 'SINAPI', rotulo: 'SINAPI' },
          { valor: 'ORSE', rotulo: 'ORSE' },
          { valor: 'SICRO', rotulo: 'SICRO' },
        ]}
      />
      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="UF" nome="uf" valor="PI" />
        <Campo
          rotulo="Data-base"
          nome="data_base"
          tipo="date"
          valor={hojeISO()}
          dica="Mês de referência da tabela publicada"
        />
      </div>
      <label className="block">
        <span className="rotulo">Arquivo CSV</span>
        <input className="campo" type="file" name="arquivo" accept=".csv,text/csv" required />
        <span className="block text-[11px] text-slate-500 mt-0.5">
          Colunas aceitas: código, descrição, unidade e preço unitário. Aceita ponto e vírgula,
          acento e decimal com vírgula.
        </span>
      </label>
    </FormularioAcao>
  )
}
