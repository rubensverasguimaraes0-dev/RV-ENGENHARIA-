'use client'

import { FormularioAcao, Campo, Selecao, AreaTexto, Marcador } from '@/components/formulario'
import { criarOrcamento, salvarCabecalho, salvarItem } from './acoes'
import { formatarValor, hojeISO, somarDias } from '@/lib/format'
import { ROTULO_MODO_BDI } from '@/lib/domain/orcamento'
import type { OrcamentoRow, ItemComPendencia } from '@/lib/dados/orcamento'

const OPCOES_MODO_BDI = Object.entries(ROTULO_MODO_BDI).map(([valor, rotulo]) => ({ valor, rotulo }))
const OPCOES_TIPO = [
  { valor: 'rapido', rotulo: 'Rápido (serviço dentro da obra)' },
  { valor: 'completo', rotulo: 'Completo (obra nova / executivo, com fases)' },
]

function percentual(fracao: number): string {
  return String(Math.round(fracao * 10000) / 100).replace('.', ',')
}

export function FormularioNovoOrcamento({ obraId }: { obraId: string }) {
  return (
    <FormularioAcao acao={criarOrcamento} className="space-y-2" rotuloBotao="Criar orçamento">
      <input type="hidden" name="obra_id" value={obraId} />
      <Campo rotulo="Título" nome="titulo" obrigatorio placeholder="Reforma da fachada" />
      <Campo rotulo="Número" nome="numero" placeholder="opcional" />
      <Selecao rotulo="Tipo" nome="tipo" valor="rapido" opcoes={OPCOES_TIPO} />
      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Margem (%)" nome="margem" inputMode="decimal" valor="30" />
        <Campo rotulo="BDI (%)" nome="bdi" inputMode="decimal" valor="0" />
      </div>
      <Selecao rotulo="Exibição do BDI" nome="modo_bdi" valor="embutido" opcoes={OPCOES_MODO_BDI} />
      <Campo rotulo="Validade" nome="validade" tipo="date" valor={somarDias(hojeISO(), 15)} />
    </FormularioAcao>
  )
}

export function FormularioCabecalho({
  obraId,
  orcamento,
  textosPadrao,
}: {
  obraId: string
  orcamento: OrcamentoRow
  textosPadrao: { prazo: string; garantia: string; nao_incluso: string }
}) {
  const c = orcamento.condicoes

  return (
    <FormularioAcao acao={salvarCabecalho} className="space-y-2" rotuloBotao="Salvar orçamento">
      <input type="hidden" name="id" value={orcamento.id} />
      <input type="hidden" name="obra_id" value={obraId} />

      <Campo rotulo="Título" nome="titulo" valor={orcamento.titulo} obrigatorio />
      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Número" nome="numero" valor={orcamento.numero} />
        <Campo rotulo="Validade" nome="validade" tipo="date" valor={orcamento.validade} />
      </div>
      <Selecao rotulo="Tipo" nome="tipo" valor={orcamento.tipo} opcoes={OPCOES_TIPO} />
      <div className="grid grid-cols-2 gap-2">
        <Campo
          rotulo="Margem (%)"
          nome="margem"
          inputMode="decimal"
          valor={percentual(orcamento.margem)}
          dica="Usada quando o item não tem preço próprio"
        />
        <Campo rotulo="BDI (%)" nome="bdi" inputMode="decimal" valor={percentual(orcamento.bdi)} />
      </div>
      <Selecao
        rotulo="Exibição do BDI"
        nome="modo_bdi"
        valor={orcamento.modo_bdi}
        opcoes={OPCOES_MODO_BDI}
      />

      <div className="rounded border border-slate-300 bg-slate-50 p-2 space-y-2">
        <p className="text-[11px] font-semibold uppercase text-slate-500">Condições comerciais</p>
        <Campo rotulo="Prazo de execução" nome="condicao_prazo" valor={c.prazo ?? textosPadrao.prazo} />
        <Campo rotulo="Forma de pagamento" nome="condicao_pagamento" valor={c.forma_pagamento ?? ''} />
        <Campo rotulo="Garantia" nome="condicao_garantia" valor={c.garantia ?? textosPadrao.garantia} />
        <AreaTexto
          rotulo="O que não está incluso"
          nome="condicao_nao_incluso"
          linhas={2}
          valor={c.nao_incluso ?? textosPadrao.nao_incluso}
        />
      </div>

      <AreaTexto
        rotulo="Memorial descritivo"
        nome="memorial"
        linhas={5}
        valor={orcamento.memorial}
        dica="Sai junto com a planilha, em página própria."
      />
    </FormularioAcao>
  )
}

export function FormularioItem({
  obraId,
  orcamentoId,
  item,
  proximaOrdem,
  completo,
}: {
  obraId: string
  orcamentoId: string
  item: ItemComPendencia | null
  proximaOrdem: number
  completo: boolean
}) {
  return (
    <FormularioAcao acao={salvarItem} className="space-y-2" rotuloBotao="Salvar item">
      <input type="hidden" name="orcamento_id" value={orcamentoId} />
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="id" value={item?.id ?? ''} />
      <input type="hidden" name="ordem" value={item?.ordem ?? proximaOrdem} />

      {completo && (
        <div className="grid grid-cols-2 gap-2">
          <Campo
            rotulo="Fase"
            nome="fase"
            valor={item?.fase}
            placeholder="1.1"
            dica="Formato 1, 1.1, 1.1.1"
          />
          <Selecao
            rotulo="Base de preço"
            nome="base_referencia"
            valor={item?.base_referencia ?? 'proprio'}
            opcoes={[
              { valor: 'proprio', rotulo: 'Item próprio (RV)' },
              { valor: 'SINAPI', rotulo: 'SINAPI' },
              { valor: 'ORSE', rotulo: 'ORSE' },
              { valor: 'SICRO', rotulo: 'SICRO' },
            ]}
          />
        </div>
      )}
      {!completo && <input type="hidden" name="base_referencia" value={item?.base_referencia ?? 'proprio'} />}

      <Campo rotulo="Descrição" nome="descricao" valor={item?.descricao} obrigatorio />
      {completo && (
        <Campo rotulo="Código da composição" nome="codigo_referencia" valor={item?.codigo_referencia} />
      )}

      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Unidade" nome="unidade" valor={item?.unidade} placeholder="m², m, un, vb" />
        <Campo rotulo="Quantidade" nome="quantidade" inputMode="decimal" valor={item?.quantidade ?? ''} />
      </div>

      <div className="rounded border border-slate-300 bg-slate-50 p-2">
        <p className="text-[11px] font-semibold uppercase text-slate-500 mb-1">
          Custo interno — nunca sai no documento do cliente
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Campo
            rotulo="Custo de material"
            nome="custo_material"
            inputMode="decimal"
            valor={item?.custo_material ? formatarValor(item.custo_material) : ''}
          />
          <Campo
            rotulo="Custo de mão de obra"
            nome="custo_mao_obra"
            inputMode="decimal"
            valor={item?.custo_mao_obra ? formatarValor(item.custo_mao_obra) : ''}
          />
        </div>
      </div>

      <Campo
        rotulo="Preço unitário"
        nome="preco_unitario"
        inputMode="decimal"
        valor={item?.preco_unitario ? formatarValor(item.preco_unitario) : ''}
        dica="Em branco, o preço sai do custo mais a margem. Preenchido, manda sobre o cálculo."
      />

      <Marcador
        rotulo="A cotar separadamente"
        nome="terceirizado_sem_valor"
        marcado={item?.terceirizado_sem_valor}
        dica="Aparece descrito, sem preço, e não soma no total."
      />
      <Marcador
        rotulo="Pendência / a definir"
        nome="pendencia"
        marcado={item?.pendencia}
        dica="Sai na aba de pendências e fica fora do total."
      />
      <AreaTexto rotulo="Observação" nome="observacao" linhas={2} valor={item?.observacao} />
    </FormularioAcao>
  )
}
