'use client'

import { FormularioAcao, Campo, Selecao } from '@/components/formulario'
import { salvarFornecedor, salvarTerceiro } from './acoes'

export function FormularioFornecedor() {
  return (
    <FormularioAcao acao={salvarFornecedor} className="space-y-2">
      <input type="hidden" name="id" value="" />
      <Campo rotulo="Nome" nome="nome" obrigatorio placeholder="J. Monte" />
      <Selecao
        rotulo="Categoria"
        nome="categoria"
        valor="material"
        opcoes={[
          { valor: 'material', rotulo: 'Material de construção' },
          { valor: 'locacao', rotulo: 'Locação de equipamento' },
          { valor: 'cacamba', rotulo: 'Caçamba / entulho' },
          { valor: 'solar', rotulo: 'Energia solar' },
          { valor: 'outro', rotulo: 'Outro' },
        ]}
      />
      <Campo rotulo="Contato" nome="contato" />
      <Campo
        rotulo="Condição de pagamento"
        nome="condicao_pagamento"
        placeholder="à vista no Pix / cartão em 3x"
      />
    </FormularioAcao>
  )
}

export function FormularioTerceiro() {
  return (
    <FormularioAcao acao={salvarTerceiro} className="space-y-2">
      <input type="hidden" name="id" value="" />
      <Campo rotulo="Nome" nome="nome" obrigatorio />
      <Selecao
        rotulo="Atividade"
        nome="atividade"
        vazio="— selecione —"
        opcoes={[
          'gesseiro',
          'marmoraria',
          'metalúrgica',
          'serralheria',
          'instalador',
          'vidraçaria',
          'outro',
        ].map((a) => ({ valor: a, rotulo: a }))}
      />
      <Campo rotulo="Contato" nome="contato" />
      <Selecao
        rotulo="Forma de cobrança"
        nome="forma_cobranca"
        vazio="— selecione —"
        opcoes={[
          { valor: 'm2', rotulo: 'Por m²' },
          { valor: 'unidade', rotulo: 'Por unidade' },
          { valor: 'global', rotulo: 'Valor global' },
        ]}
      />
    </FormularioAcao>
  )
}
