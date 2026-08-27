'use client'

import { FormularioAcao, Campo, Selecao, AreaTexto } from '@/components/formulario'
import { salvarCliente } from './acoes'

interface Cliente {
  id: string
  nome: string
  razao_social_comprovante: string | null
  documento: string | null
  telefone: string | null
  email: string | null
  endereco: string | null
  cliente_pai_id: string | null
  observacoes: string | null
}

export function FormularioCliente({
  cliente,
  possiveisPais,
}: {
  cliente: Cliente | null
  possiveisPais: { id: string; nome: string }[]
}) {
  return (
    <FormularioAcao acao={salvarCliente} className="space-y-2">
      <input type="hidden" name="id" value={cliente?.id ?? ''} />
      <Campo rotulo="Nome ou razão social" nome="nome" valor={cliente?.nome} obrigatorio />
      <Campo
        rotulo="Razão social do comprovante"
        nome="razao_social_comprovante"
        valor={cliente?.razao_social_comprovante}
        dica='Ex.: obra "Center Pães", comprovante em nome de "F DE SOUSA BARROS LANCHES"'
      />
      <Campo rotulo="CPF/CNPJ" nome="documento" valor={cliente?.documento} inputMode="text" />
      <Campo rotulo="Telefone" nome="telefone" valor={cliente?.telefone} inputMode="tel" />
      <Campo rotulo="E-mail" nome="email" tipo="email" valor={cliente?.email} />
      <Campo rotulo="Endereço" nome="endereco" valor={cliente?.endereco} />
      <Selecao
        rotulo="Unidade do grupo"
        nome="cliente_pai_id"
        valor={cliente?.cliente_pai_id}
        vazio="— cliente independente —"
        opcoes={possiveisPais.map((c) => ({ valor: c.id, rotulo: c.nome }))}
        dica="Use quando este CNPJ é uma unidade de um grupo já cadastrado, para cobrança conjunta"
      />
      <AreaTexto rotulo="Observações" nome="observacoes" valor={cliente?.observacoes} />
    </FormularioAcao>
  )
}
