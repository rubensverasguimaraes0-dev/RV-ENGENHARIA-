'use client'

import { useState } from 'react'
import { FormularioAcao, Campo, Selecao, AreaTexto } from '@/components/formulario'
import { CapturaFoto } from '@/components/captura-foto'
import { registrarPagamentoFuncionario } from './acoes'
import { formatarMoeda, formatarValor, lerMoeda } from '@/lib/format'

const FORMAS = ['Pix', 'Dinheiro', 'Transferência', 'Depósito']

/**
 * O Pix de uma pessoa. Fica escondido ate o usuario abrir: numa equipe de dez,
 * dez formularios abertos ao mesmo tempo viram uma parede de campos.
 */
export function FormularioPagamento({
  obraId,
  semanaId,
  funcionarioId,
  nome,
  falta,
  dataSugerida,
}: {
  obraId: string
  semanaId: string
  funcionarioId: string
  nome: string
  falta: number
  dataSugerida: string
}) {
  const [aberto, setAberto] = useState(false)
  const [valor, setValor] = useState(formatarValor(Math.max(0, falta)))

  const digitado = lerMoeda(valor) ?? 0
  const diferenca = digitado - falta

  if (!aberto) {
    return (
      <button type="button" className="botao botao-primario" onClick={() => setAberto(true)}>
        Registrar pagamento
      </button>
    )
  }

  return (
    <div className="rounded border border-rv-800 p-3 bg-white">
      <div className="font-semibold text-rv-900 mb-2 text-sm">Pagamento de {nome}</div>
      <FormularioAcao
        acao={registrarPagamentoFuncionario}
        className="space-y-2"
        rotuloBotao="Salvar pagamento"
        aoConcluir={() => setAberto(false)}
      >
        <input type="hidden" name="obra_id" value={obraId} />
        <input type="hidden" name="semana_id" value={semanaId} />
        <input type="hidden" name="funcionario_id" value={funcionarioId} />

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="rotulo">Valor pago</span>
            <input
              className="campo"
              name="valor"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </label>
          <Campo rotulo="Data do pagamento" nome="data_pagamento" tipo="date" valor={dataSugerida} />
        </div>

        {diferenca !== 0 && (
          <p className={`text-[13px] ${diferenca < 0 ? 'text-alerta-700' : 'text-erro-700'}`}>
            {diferenca < 0
              ? `${formatarMoeda(-diferenca)} a menos do que a semana apurou.`
              : `${formatarMoeda(diferenca)} a mais do que a semana apurou.`}
          </p>
        )}

        <Selecao
          rotulo="Forma"
          nome="forma_pagamento"
          valor="Pix"
          opcoes={FORMAS.map((f) => ({ valor: f, rotulo: f }))}
        />

        <AreaTexto rotulo="Observação" nome="observacao" linhas={2} />

        <div>
          <span className="rotulo">Comprovante do Pix</span>
          <CapturaFoto
            bucket="comprovantes"
            obraId={obraId}
            pasta="funcionarios"
            nomeCampo="comprovante"
            rotulo="Fotografar comprovante"
          />
        </div>

        <button type="button" className="botao botao-neutro" onClick={() => setAberto(false)}>
          Cancelar
        </button>
      </FormularioAcao>
    </div>
  )
}

/** Copia a chave Pix para a area de transferencia, para colar no banco. */
export function BotaoCopiarPix({ chave }: { chave: string }) {
  const [copiado, setCopiado] = useState(false)

  return (
    <button
      type="button"
      className={`acao ${copiado ? 'text-ok-700' : 'acao-neutra'}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(chave)
        } catch {
          return
        }
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2000)
      }}
    >
      {copiado ? 'copiada' : 'copiar chave'}
    </button>
  )
}
