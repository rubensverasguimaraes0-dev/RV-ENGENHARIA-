'use client'

import { FormularioAcao, Campo, Selecao } from '@/components/formulario'
import { importarPrecos, salvarServicoProprio } from './acoes'
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
          { valor: 'proprio', rotulo: 'Tabela da RV — os seus preços' },
        ]}
      />
      <Selecao
        rotulo="Versão da tabela"
        nome="desonerado"
        valor="nao"
        opcoes={[
          { valor: 'nao', rotulo: 'Não desonerada — usual em obra privada' },
          { valor: 'sim', rotulo: 'Desonerada — sem INSS sobre a folha' },
        ]}
        dica="Muda todo preço que tem mão de obra. As duas convivem sem se sobrescrever."
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

/**
 * Um serviço da RV por vez, digitado na hora. É o caminho de quem está na obra
 * e lembrou de um preço — sem planilha, sem CSV, sem baixar nada.
 */
export function FormularioServicoProprio() {
  return (
    <FormularioAcao
      acao={salvarServicoProprio}
      className="space-y-2"
      rotuloBotao="Guardar serviço"
    >
      <Campo
        rotulo="O serviço"
        nome="descricao"
        obrigatorio
        dica="Como você diria ao cliente: “assentamento de piso cerâmico, com material”"
      />
      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Unidade" nome="unidade" obrigatorio dica="m², m, un, vb, diária" />
        <Campo rotulo="Preço que a RV cobra" nome="preco_unitario" obrigatorio dica="Ex.: 78,50" />
      </div>
      <Campo
        rotulo="Código (opcional)"
        nome="codigo"
        dica="Em branco, o app numera sozinho: RV-0001, RV-0002…"
      />
    </FormularioAcao>
  )
}
