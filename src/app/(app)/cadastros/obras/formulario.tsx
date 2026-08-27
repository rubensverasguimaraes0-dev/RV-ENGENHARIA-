'use client'

import { FormularioAcao, Campo, Selecao, AreaTexto } from '@/components/formulario'
import { salvarObra, salvarLocal } from './acoes'
import { formatarValor } from '@/lib/format'

export interface ObraForm {
  id: string
  nome: string
  cliente_id: string
  cliente_pagador_id: string | null
  endereco: string | null
  tipo: string | null
  forma_contratacao: string
  data_inicio: string | null
  data_prevista_fim: string | null
  status: string
  valor_contrato: number
  percentual_rateio_parceiro: number
  base_rateio_parceiro: string
  observacoes: string | null
}

const TIPOS = [
  'construção',
  'reforma',
  'forro',
  'piso',
  'elétrica',
  'pintura',
  'serviço técnico',
  'outro',
]

export function FormularioObra({
  obra,
  clientes,
}: {
  obra: ObraForm | null
  clientes: { id: string; nome: string }[]
}) {
  const opcoesClientes = clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))

  return (
    <FormularioAcao acao={salvarObra} className="space-y-2">
      <input type="hidden" name="id" value={obra?.id ?? ''} />
      <Campo rotulo="Nome da obra" nome="nome" valor={obra?.nome} obrigatorio />
      <Selecao
        rotulo="Cliente"
        nome="cliente_id"
        valor={obra?.cliente_id}
        vazio="— selecione —"
        opcoes={opcoesClientes}
        obrigatorio
      />
      <Selecao
        rotulo="Cliente que paga"
        nome="cliente_pagador_id"
        valor={obra?.cliente_pagador_id}
        vazio="— o mesmo cliente —"
        opcoes={opcoesClientes}
        dica="Use quando quem paga não é o dono do local. O relatório sai em nome de quem paga."
      />
      <Campo rotulo="Endereço" nome="endereco" valor={obra?.endereco} />
      <Selecao
        rotulo="Tipo"
        nome="tipo"
        valor={obra?.tipo}
        vazio="— selecione —"
        opcoes={TIPOS.map((t) => ({ valor: t, rotulo: t }))}
      />
      <Selecao
        rotulo="Forma de contratação"
        nome="forma_contratacao"
        valor={obra?.forma_contratacao ?? 'diaria'}
        opcoes={[
          { valor: 'diaria', rotulo: 'Por diária (equipe própria)' },
          { valor: 'empreitada', rotulo: 'Empreitada global (valor fechado)' },
          { valor: 'medicao', rotulo: 'Por medição (m², m linear, unidade)' },
          { valor: 'unidade', rotulo: 'Por unidade replicada' },
        ]}
        dica="Uma obra pode combinar formas; o fechamento soma todas."
      />
      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Início" nome="data_inicio" tipo="date" valor={obra?.data_inicio} />
        <Campo
          rotulo="Previsão de término"
          nome="data_prevista_fim"
          tipo="date"
          valor={obra?.data_prevista_fim}
        />
      </div>
      <Selecao
        rotulo="Situação"
        nome="status"
        valor={obra?.status ?? 'em_andamento'}
        opcoes={[
          { valor: 'orcada', rotulo: 'Orçada' },
          { valor: 'em_andamento', rotulo: 'Em andamento' },
          { valor: 'paralisada', rotulo: 'Paralisada' },
          { valor: 'concluida', rotulo: 'Concluída' },
        ]}
      />
      <Campo
        rotulo="Valor do contrato"
        nome="valor_contrato"
        valor={obra ? formatarValor(obra.valor_contrato) : ''}
        inputMode="decimal"
        placeholder="10.960,00"
      />
      <div className="grid grid-cols-2 gap-2">
        <Campo
          rotulo="Rateio do parceiro (%)"
          nome="percentual_rateio_parceiro"
          valor={obra ? (obra.percentual_rateio_parceiro * 100).toString().replace('.', ',') : '50'}
          inputMode="decimal"
        />
        <Selecao
          rotulo="Base do rateio"
          nome="base_rateio_parceiro"
          valor={obra?.base_rateio_parceiro ?? 'resultado_total'}
          opcoes={[
            { valor: 'resultado_total', rotulo: 'Resultado da obra' },
            { valor: 'margem_mao_obra', rotulo: 'Margem da mão de obra' },
          ]}
        />
      </div>
      <AreaTexto rotulo="Observações" nome="observacoes" valor={obra?.observacoes} />
    </FormularioAcao>
  )
}

export function FormularioLocal({ obraId }: { obraId: string }) {
  return (
    <FormularioAcao acao={salvarLocal} className="grid gap-2 sm:grid-cols-2" rotuloBotao="Adicionar local">
      <input type="hidden" name="obra_id" value={obraId} />
      <Campo rotulo="Nome do local" nome="nome" obrigatorio placeholder="Apto 1802" />
      <Campo rotulo="Endereço" nome="endereco" />
    </FormularioAcao>
  )
}
