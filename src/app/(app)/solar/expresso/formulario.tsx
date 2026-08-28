'use client'

import { useState } from 'react'
import { FormularioAcao, Campo, Selecao } from '@/components/formulario'
import { CapturaFoto } from '@/components/captura-foto'
import { gerarPropostaExpressa } from './acoes'

const TELHADOS = ['cerâmica', 'fibrocimento', 'metálico', 'laje', 'solo']

export function FormularioExpresso({
  clientes,
  concessionariaPadrao,
}: {
  clientes: { id: string; nome: string; telefone: string | null }[]
  concessionariaPadrao: string
}) {
  const [clienteId, setClienteId] = useState('')
  const [temAnexo, setTemAnexo] = useState(false)
  const novoCliente = clienteId === ''

  return (
    <FormularioAcao
      acao={gerarPropostaExpressa}
      className="space-y-3"
      rotuloBotao="Gerar a proposta"
    >
      {/* 1. De quem é a conta */}
      <div className="rounded border border-slate-300 bg-slate-50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
          1. De quem é a conta
        </p>

        <label className="block">
          <span className="rotulo">Cliente</span>
          <select
            className="campo"
            name="cliente_id"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          >
            <option value="">— cliente novo, cadastrar agora —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>

        {novoCliente && (
          <div className="mt-2 space-y-2">
            <Campo rotulo="Nome do cliente" nome="cliente_nome" obrigatorio />
            <div className="grid grid-cols-2 gap-2">
              <Campo
                rotulo="WhatsApp"
                nome="cliente_telefone"
                inputMode="tel"
                placeholder="(86) 99999-9999"
                dica="Para enviar a proposta"
              />
              <Campo rotulo="CPF/CNPJ" nome="cliente_documento" />
            </div>
          </div>
        )}
      </div>

      {/* 2. A conta de energia */}
      <div className="rounded border border-rv-600 bg-rv-50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-rv-800 mb-2">
          2. A conta de energia
        </p>
        <CapturaFoto
          bucket="arquivos"
          obraId={clienteId || 'novos-clientes'}
          pasta="contas-de-energia"
          nomeCampo="anexo"
          rotulo="Fotografar a conta"
          aoMudar={(f) => setTemAnexo(f.length > 0)}
        />
        {!temAnexo && (
          <p className="mt-1 text-[11px] text-slate-600">
            A conta fica guardada junto ao cliente. Os números abaixo você lê nela.
          </p>
        )}
      </div>

      {/* 3. O que a conta diz */}
      <div className="rounded border border-slate-300 bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
          3. O que está na conta
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Campo
            rotulo="Consumo médio (kWh)"
            nome="consumo_medio"
            inputMode="decimal"
            obrigatorio
            placeholder="500"
            dica="A média dos 12 meses"
          />
          <Campo
            rotulo="Tarifa (R$/kWh)"
            nome="tarifa"
            inputMode="decimal"
            obrigatorio
            placeholder="1,00"
            dica="Com impostos"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Selecao
            rotulo="Ligação"
            nome="tipo_ligacao"
            valor="monofasica"
            opcoes={[
              { valor: 'monofasica', rotulo: 'Monofásica' },
              { valor: 'bifasica', rotulo: 'Bifásica' },
              { valor: 'trifasica', rotulo: 'Trifásica' },
            ]}
          />
          <Campo rotulo="Unidade consumidora" nome="uc" />
        </div>
        <input type="hidden" name="concessionaria" value={concessionariaPadrao} />
      </div>

      {/* 4. Da obra (opcional) */}
      <details className="rounded border border-slate-300 bg-white px-3">
        <summary className="cursor-pointer py-2 text-sm font-semibold text-rv-800">
          Telhado e distância (opcional)
        </summary>
        <div className="grid grid-cols-2 gap-2 pb-3">
          <Selecao
            rotulo="Tipo de telhado"
            nome="tipo_telhado"
            vazio="— não informado —"
            opcoes={TELHADOS.map((t) => ({ valor: t, rotulo: t }))}
          />
          <Campo
            rotulo="Distância do quadro (m)"
            nome="distancia_quadro"
            inputMode="decimal"
            valor="20"
          />
        </div>
      </details>
    </FormularioAcao>
  )
}
