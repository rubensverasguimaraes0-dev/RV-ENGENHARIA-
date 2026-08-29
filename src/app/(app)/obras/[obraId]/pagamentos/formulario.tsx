'use client'

import { useState } from 'react'
import { FormularioAcao, Campo, Selecao, AreaTexto, Marcador } from '@/components/formulario'
import { CapturaFoto } from '@/components/captura-foto'
import { registrarRecebimento, salvarParcela } from './acoes'
import { formatarData, formatarMoeda, formatarValor, hojeISO, lerMoeda } from '@/lib/format'

const FORMAS = ['pix', 'espécie', 'transferência', 'cartão', 'boleto', 'cheque']

export function FormularioParcela({
  obraId,
  proximoNumero,
}: {
  obraId: string
  proximoNumero: number
}) {
  return (
    <FormularioAcao acao={salvarParcela} className="space-y-2" rotuloBotao="Adicionar parcela">
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="id" value="" />
      <div className="grid gap-2 sm:grid-cols-2">
        <Campo
          rotulo="Número"
          nome="numero_parcela"
          inputMode="numeric"
          valor={String(proximoNumero)}
          obrigatorio
        />
        <Campo rotulo="Data prevista" nome="data_prevista" tipo="date" />
      </div>
      <Campo rotulo="Valor previsto" nome="valor_previsto" inputMode="decimal" placeholder="3.000,00" />
      <Marcador
        rotulo="Parcela balão (saldo do contrato)"
        nome="balao"
        dica="O valor é calculado sozinho: o que faltar do contrato depois das outras parcelas."
      />
      <AreaTexto rotulo="Observação" nome="observacao" linhas={2} />
    </FormularioAcao>
  )
}

export function FormularioRecebimento({
  obraId,
  parcela,
}: {
  obraId: string
  parcela: {
    id: string
    numero_parcela: number
    valor_previsto: number
    valor_recebido: number | null
    valor_outro_contrato: number
    data_prevista: string | null
    data_recebimento: string | null
    forma_pagamento: string | null
    observacao: string | null
    balao: boolean
  }
}) {
  const [recebido, setRecebido] = useState(
    parcela.valor_recebido ? formatarValor(parcela.valor_recebido) : formatarValor(parcela.valor_previsto),
  )
  const [outro, setOutro] = useState(
    parcela.valor_outro_contrato ? formatarValor(parcela.valor_outro_contrato) : '',
  )

  const liquido = (lerMoeda(recebido) ?? 0) - (lerMoeda(outro) ?? 0)
  // Recebeu menos do que estava combinado: a diferenca precisa aparecer ANTES
  // de salvar, senao vira surpresa no fechamento.
  const diferenca = liquido - parcela.valor_previsto

  return (
    <FormularioAcao acao={registrarRecebimento} className="space-y-2" rotuloBotao="Registrar recebimento">
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="id" value={parcela.id} />

      <div className="rounded border border-slate-300 bg-rv-50 px-3 py-2 text-sm">
        <div className="font-semibold text-rv-900">
          Parcela {parcela.numero_parcela}
          {parcela.balao && ' — saldo do contrato'}
        </div>
        <div className="text-slate-600 text-[13px]">
          Combinado: <strong>{formatarMoeda(parcela.valor_previsto)}</strong>
          {parcela.data_prevista && <> · vencimento {formatarData(parcela.data_prevista)}</>}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="rotulo">Valor recebido</span>
          <input
            className="campo"
            name="valor_recebido"
            inputMode="decimal"
            value={recebido}
            onChange={(e) => setRecebido(e.target.value)}
          />
        </label>
        <Campo
          rotulo="Data do recebimento"
          nome="data_recebimento"
          tipo="date"
          valor={parcela.data_recebimento ?? hojeISO()}
        />
      </div>

      <Selecao
        rotulo="Forma de pagamento"
        nome="forma_pagamento"
        valor={parcela.forma_pagamento ?? ''}
        vazio="— selecione —"
        opcoes={FORMAS.map((f) => ({ valor: f, rotulo: f }))}
        dica="Varia a cada parcela; fica registrada individualmente."
      />

      <label className="block">
        <span className="rotulo">Deste valor, quanto é de outro contrato</span>
        <input
          className="campo"
          name="valor_outro_contrato"
          inputMode="decimal"
          placeholder="0,00"
          value={outro}
          onChange={(e) => setOutro(e.target.value)}
        />
        <span className="block text-[11px] text-slate-500 mt-0.5">
          Ex.: recebeu R$ 4.000,00, sendo R$ 1.000,00 do saldo do contrato anterior.
        </span>
      </label>

      <div className="rounded border border-slate-300 px-3 py-2">
        <p className="text-sm font-medium text-rv-900">
          Entra nesta obra: <strong>{formatarMoeda(liquido)}</strong>
        </p>
        {diferenca !== 0 && (
          <p className={`text-[13px] mt-0.5 ${diferenca < 0 ? 'text-alerta-700' : 'text-ok-700'}`}>
            {diferenca < 0
              ? `${formatarMoeda(-diferenca)} a menos do que estava combinado para esta parcela.`
              : `${formatarMoeda(diferenca)} a mais do que estava combinado para esta parcela.`}
          </p>
        )}
      </div>

      <AreaTexto
        rotulo="Observação"
        nome="observacao"
        linhas={2}
        valor={parcela.observacao}
        dica="Sai explícita no cronograma enviado ao cliente."
      />

      <div>
        <span className="rotulo">Comprovante do pagamento</span>
        <CapturaFoto
          bucket="comprovantes"
          obraId={obraId}
          pasta="pagamentos"
          nomeCampo="comprovante"
          rotulo="Fotografar comprovante"
        />
        <p className="mt-1 text-[11px] text-slate-500">
          O comprovante anexado aqui sai numa página própria, ao final do cronograma em PDF que
          vai para o cliente.
        </p>
      </div>
    </FormularioAcao>
  )
}
