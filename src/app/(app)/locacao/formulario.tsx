'use client'

import { useState } from 'react'
import { FormularioAcao, Campo, Selecao, AreaTexto } from '@/components/formulario'
import { criarContrato, importarTabelaPrecos, registrarDevolucao, salvarEquipamento } from './acoes'
import { formatarMoeda, formatarValor, hojeISO, somarDias } from '@/lib/format'
import type { EquipamentoRow, ContratoRow } from '@/lib/dados/locacao'

const CATEGORIAS = [
  'martelete',
  'betoneira',
  'parafusadeira',
  'serra',
  'compactador',
  'vibrador de concreto',
  'andaime',
  'outro',
]

export function FormularioEquipamento({ equipamento }: { equipamento: EquipamentoRow | null }) {
  return (
    <FormularioAcao acao={salvarEquipamento} className="space-y-2" rotuloBotao="Salvar equipamento">
      <input type="hidden" name="id" value={equipamento?.id ?? ''} />

      <Campo rotulo="Descrição" nome="descricao" valor={equipamento?.descricao} obrigatorio />
      <div className="grid grid-cols-2 gap-2">
        <Selecao
          rotulo="Categoria"
          nome="categoria"
          valor={equipamento?.categoria}
          vazio="— selecione —"
          opcoes={CATEGORIAS.map((c) => ({ valor: c, rotulo: c }))}
        />
        <Campo rotulo="Patrimônio" nome="patrimonio" valor={equipamento?.patrimonio} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Campo
          rotulo="Quantidade em estoque"
          nome="quantidade_estoque"
          inputMode="numeric"
          valor={equipamento?.quantidade_estoque ?? 1}
        />
        <Campo
          rotulo="Valor de compra"
          nome="valor_compra"
          inputMode="decimal"
          valor={equipamento?.valor_compra ? formatarValor(equipamento.valor_compra) : ''}
        />
      </div>
      <Selecao
        rotulo="Situação"
        nome="status"
        valor={equipamento?.status ?? 'disponivel'}
        opcoes={[
          { valor: 'disponivel', rotulo: 'Disponível' },
          { valor: 'locado', rotulo: 'Locado' },
          { valor: 'manutencao', rotulo: 'Em manutenção' },
        ]}
      />

      <div className="rounded border border-slate-300 bg-slate-50 p-2">
        <p className="text-[11px] font-semibold uppercase text-slate-500 mb-1">Tabela de preços</p>
        <div className="grid grid-cols-3 gap-2">
          <Campo
            rotulo="Diária"
            nome="valor_diaria"
            inputMode="decimal"
            valor={equipamento?.tabela ? formatarValor(equipamento.tabela.valor_diaria) : ''}
          />
          <Campo
            rotulo="Semana"
            nome="valor_semana"
            inputMode="decimal"
            valor={equipamento?.tabela ? formatarValor(equipamento.tabela.valor_semana) : ''}
          />
          <Campo
            rotulo="Mês"
            nome="valor_mes"
            inputMode="decimal"
            valor={equipamento?.tabela ? formatarValor(equipamento.tabela.valor_mes) : ''}
          />
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          A cobrança combina mês, semana e diária, sempre pelo que sair mais barato ao cliente.
        </p>
      </div>
    </FormularioAcao>
  )
}

export function FormularioImportacaoEquipamentos() {
  return (
    <FormularioAcao acao={importarTabelaPrecos} className="space-y-2" rotuloBotao="Importar tabela">
      <label className="block">
        <span className="rotulo">Arquivo CSV</span>
        <input className="campo" type="file" name="arquivo" accept=".csv,text/csv" required />
        <span className="block text-[11px] text-slate-500 mt-0.5">
          Colunas aceitas: descrição, categoria, patrimônio, quantidade, diária, semana e mês.
          Equipamento já cadastrado é atualizado pela descrição.
        </span>
      </label>
    </FormularioAcao>
  )
}

export function FormularioContrato({
  clientes,
  obras,
  equipamentos,
}: {
  clientes: { id: string; nome: string }[]
  obras: { id: string; nome: string }[]
  equipamentos: EquipamentoRow[]
}) {
  const [usoInterno, setUsoInterno] = useState(false)
  const [selecionados, setSelecionados] = useState<string[]>([])

  return (
    <FormularioAcao acao={criarContrato} className="space-y-2" rotuloBotao="Abrir contrato">
      <label className="flex items-start gap-2 py-1">
        <input
          type="checkbox"
          name="uso_interno"
          className="mt-1 h-4 w-4"
          checked={usoInterno}
          onChange={(e) => setUsoInterno(e.target.checked)}
        />
        <span>
          <span className="text-sm font-medium">Uso interno da RV</span>
          <span className="block text-[11px] text-slate-500">
            Equipamento próprio alocado a uma obra: entra como custo interno, sem gerar receita.
          </span>
        </span>
      </label>

      {!usoInterno && (
        <Selecao
          rotulo="Cliente"
          nome="cliente_id"
          vazio="— selecione —"
          opcoes={clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))}
        />
      )}

      <Selecao
        rotulo={usoInterno ? 'Obra que recebe o custo' : 'Obra (opcional)'}
        nome="obra_id"
        vazio="— nenhuma —"
        opcoes={obras.map((o) => ({ valor: o.id, rotulo: o.nome }))}
      />

      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Data de saída" nome="data_saida" tipo="date" valor={hojeISO()} />
        <Campo
          rotulo="Devolução prevista"
          nome="data_prevista"
          tipo="date"
          valor={somarDias(hojeISO(), 7)}
        />
      </div>

      <div className="rounded border border-slate-300 p-2">
        <p className="text-[11px] font-semibold uppercase text-slate-500 mb-1">Equipamentos</p>
        <ul className="max-h-56 overflow-y-auto space-y-1">
          {equipamentos.map((e) => {
            const marcado = selecionados.includes(e.id)
            return (
              <li key={e.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="equipamento_id"
                    value={e.id}
                    className="h-4 w-4"
                    checked={marcado}
                    onChange={(ev) =>
                      setSelecionados(
                        ev.target.checked
                          ? [...selecionados, e.id]
                          : selecionados.filter((id) => id !== e.id),
                      )
                    }
                  />
                  <span className="flex-1">
                    {e.descricao}
                    {e.tabela && (
                      <span className="block text-[10px] text-slate-500">
                        {formatarMoeda(e.tabela.valor_diaria)}/dia ·{' '}
                        {formatarMoeda(e.tabela.valor_semana)}/sem ·{' '}
                        {formatarMoeda(e.tabela.valor_mes)}/mês
                      </span>
                    )}
                  </span>
                  {marcado && (
                    <input
                      className="campo w-16 py-1 text-sm"
                      name={`quantidade_${e.id}`}
                      inputMode="numeric"
                      defaultValue="1"
                      aria-label={`Quantidade de ${e.descricao}`}
                    />
                  )}
                </label>
              </li>
            )
          })}
        </ul>
      </div>

      {!usoInterno && (
        <div className="grid grid-cols-2 gap-2">
          <Campo rotulo="Caução" nome="caucao" inputMode="decimal" />
          <Selecao
            rotulo="Forma de pagamento"
            nome="forma_pagamento"
            vazio="— selecione —"
            opcoes={['pix', 'dinheiro', 'cartão', 'transferência', 'boleto'].map((f) => ({
              valor: f,
              rotulo: f,
            }))}
          />
        </div>
      )}

      <AreaTexto rotulo="Observação" nome="observacao" linhas={2} />
    </FormularioAcao>
  )
}

export function FormularioDevolucao({ contrato }: { contrato: ContratoRow }) {
  return (
    <FormularioAcao acao={registrarDevolucao} className="space-y-2" rotuloBotao="Registrar devolução">
      <input type="hidden" name="id" value={contrato.id} />

      <Campo rotulo="Data efetiva da devolução" nome="data_devolucao" tipo="date" valor={hojeISO()} />

      <div className="rounded border border-slate-300 p-2 space-y-2">
        <p className="text-[11px] font-semibold uppercase text-slate-500">
          Estado de cada equipamento
        </p>
        {contrato.itens.map((i) => (
          <Selecao
            key={i.id}
            rotulo={i.descricao}
            nome={`estado_${i.id}`}
            vazio="— não informado —"
            opcoes={[
              { valor: 'bom', rotulo: 'Bom estado' },
              { valor: 'desgaste', rotulo: 'Desgaste normal' },
              { valor: 'avaria', rotulo: 'Com avaria' },
              { valor: 'faltando peca', rotulo: 'Faltando peça' },
            ]}
          />
        ))}
      </div>

      <AreaTexto rotulo="Observação da devolução" nome="observacao" linhas={2} />

      {contrato.apuracao.dias_adicionais > 0 && (
        <p className="text-xs rounded border border-alerta-700/30 bg-alerta-100 text-alerta-700 px-2 py-1.5">
          Até hoje são {contrato.apuracao.dias_adicionais} dia(s) além do previsto, o que acrescenta{' '}
          {formatarMoeda(contrato.apuracao.valor_adicional)}. O valor é recalculado pela data que
          você informar acima.
        </p>
      )}
    </FormularioAcao>
  )
}
