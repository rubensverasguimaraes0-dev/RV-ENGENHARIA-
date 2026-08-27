'use client'

import { FormularioAcao, Campo, Selecao, AreaTexto } from '@/components/formulario'
import { salvarFuncionario } from './acoes'
import { formatarValor } from '@/lib/format'
import type { Funcionario } from '@/lib/domain/tipos'

const FUNCOES = [
  'pedreiro',
  'servente',
  'ajudante',
  'eletricista',
  'gesseiro',
  'pintor',
  'encanador',
  'engenheiro',
  'outro',
]

export function FormularioFuncionario({
  funcionario,
}: {
  funcionario: (Funcionario & { observacoes: string | null }) | null
}) {
  return (
    <FormularioAcao acao={salvarFuncionario} className="space-y-2">
      <input type="hidden" name="id" value={funcionario?.id ?? ''} />
      <Campo rotulo="Nome" nome="nome" valor={funcionario?.nome} obrigatorio />
      <Selecao
        rotulo="Tipo"
        nome="tipo"
        valor={funcionario?.tipo ?? 'funcionario'}
        opcoes={[
          { valor: 'funcionario', rotulo: 'Funcionário (recebe diária)' },
          { valor: 'parceiro', rotulo: 'Parceiro/sócio (participa do resultado)' },
        ]}
      />
      <Selecao
        rotulo="Função"
        nome="funcao"
        valor={funcionario?.funcao}
        vazio="— selecione —"
        opcoes={FUNCOES.map((f) => ({ valor: f, rotulo: f }))}
      />
      <Campo
        rotulo="Valor da diária"
        nome="valor_diaria"
        valor={funcionario ? formatarValor(funcionario.valor_diaria) : ''}
        inputMode="decimal"
        placeholder="180,00"
        dica="Vale a partir de agora; lançamentos anteriores não mudam. Parceiro fica sem diária."
      />
      <Campo rotulo="Telefone" nome="telefone" valor={funcionario?.telefone} inputMode="tel" />
      <Campo
        rotulo="Chave PIX"
        nome="chave_pix"
        valor={funcionario?.chave_pix}
        dica="Sai no recibo de pagamento da semana"
      />
      <Selecao
        rotulo="Situação"
        nome="status"
        valor={funcionario?.status ?? 'ativo'}
        opcoes={[
          { valor: 'ativo', rotulo: 'Ativo' },
          { valor: 'alocado', rotulo: 'Alocado em outra obra' },
          { valor: 'desligado', rotulo: 'Desligado' },
        ]}
      />
      <div className="grid grid-cols-2 gap-2">
        <Campo
          rotulo="Entrada na equipe"
          nome="data_entrada"
          tipo="date"
          valor={funcionario?.data_entrada}
        />
        <Campo rotulo="Saída" nome="data_saida" tipo="date" valor={funcionario?.data_saida} />
      </div>
      <AreaTexto rotulo="Observações" nome="observacoes" valor={funcionario?.observacoes} />
    </FormularioAcao>
  )
}
