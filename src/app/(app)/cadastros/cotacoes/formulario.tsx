'use client'

import { FormularioAcao, Campo, Selecao, Marcador } from '@/components/formulario'
import { criarCotacao, importarItensCSV, salvarItemCotacao } from './acoes'
import { hojeISO, somarDias } from '@/lib/format'

export function FormularioNovaCotacao({
  fornecedores,
}: {
  fornecedores: { id: string; nome: string }[]
}) {
  return (
    <FormularioAcao acao={criarCotacao} className="space-y-2" rotuloBotao="Registrar cotação">
      <Selecao
        rotulo="Fornecedor"
        nome="fornecedor_id"
        vazio="— selecione —"
        obrigatorio
        opcoes={fornecedores.map((f) => ({ valor: f.id, rotulo: f.nome }))}
      />
      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Nº do documento" nome="numero_documento" placeholder="0000102431" />
        <Campo rotulo="Data" nome="data" tipo="date" valor={hojeISO()} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Vendedor" nome="vendedor" />
        <Campo rotulo="Validade" nome="validade" tipo="date" valor={somarDias(hojeISO(), 30)} />
      </div>
      <Campo
        rotulo="Condição de pagamento"
        nome="condicao_pagamento"
        placeholder="à vista no Pix / cartão em 3x"
      />
      <Campo
        rotulo="Total do documento"
        nome="total"
        inputMode="decimal"
        placeholder="4.708,00"
        dica="Opcional; serve para conferir com a soma dos itens."
      />
    </FormularioAcao>
  )
}

export function FormularioItemCotacao({ cotacaoId }: { cotacaoId: string }) {
  return (
    <FormularioAcao acao={salvarItemCotacao} className="space-y-2" rotuloBotao="Adicionar item">
      <input type="hidden" name="cotacao_id" value={cotacaoId} />
      <input type="hidden" name="id" value="" />

      <Campo rotulo="Categoria" nome="categoria" obrigatorio placeholder="módulo, inversor, placa" />
      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Marca" nome="marca" />
        <Campo rotulo="Modelo" nome="modelo" />
      </div>
      <Campo
        rotulo="Especificação"
        nome="especificacao"
        placeholder="610 Wp, 5 kW, 2,5mm"
        dica="Junto com marca e modelo, identifica o produto na comparação."
      />
      <div className="grid grid-cols-3 gap-2">
        <Campo rotulo="Unidade" nome="unidade" placeholder="un, m" />
        <Campo rotulo="Quantidade" nome="quantidade" inputMode="decimal" />
        <Campo rotulo="Preço unit." nome="preco_unitario" inputMode="decimal" />
      </div>
      <Marcador
        rotulo="Item estimado"
        nome="estimado"
        dica="Faltou na cotação e entrou por estimativa."
      />
      <Marcador
        rotulo="Substituído por equivalente"
        nome="substituido"
        dica="O fornecedor trocou o item cotado."
      />
    </FormularioAcao>
  )
}

export function FormularioImportacaoItens({ cotacaoId }: { cotacaoId: string }) {
  return (
    <FormularioAcao acao={importarItensCSV} className="space-y-2" rotuloBotao="Importar itens">
      <input type="hidden" name="cotacao_id" value={cotacaoId} />
      <label className="block">
        <span className="rotulo">Arquivo CSV</span>
        <input className="campo" type="file" name="arquivo" accept=".csv,text/csv" required />
        <span className="block text-[11px] text-slate-500 mt-0.5">
          Colunas aceitas: categoria, marca, modelo, especificação, unidade, quantidade e preço
          unitário.
        </span>
      </label>
    </FormularioAcao>
  )
}
