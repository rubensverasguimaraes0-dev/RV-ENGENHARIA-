'use client'

import { useState } from 'react'
import { FormularioAcao, Campo, Selecao } from '@/components/formulario'
import { CapturaFoto } from '@/components/captura-foto'
import { criarProjetoSolar, salvarProjetoSolar } from './acoes'
import { formatarValor } from '@/lib/format'
import type { ProjetoSolar } from '@/lib/dados/solar'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const TELHADOS = ['cerâmica', 'fibrocimento', 'metálico', 'laje', 'solo']

function CamposConsumo({ projeto }: { projeto: ProjetoSolar | null }) {
  const inicial = projeto?.consumo_mensal ?? []
  const [porMes, setPorMes] = useState(inicial.length > 1)

  return (
    <>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={porMes}
          onChange={(e) => setPorMes(e.target.checked)}
        />
        Informar o consumo mês a mês
      </label>

      {porMes ? (
        <div className="grid grid-cols-3 gap-1">
          {MESES.map((m, i) => (
            <label key={m} className="block">
              <span className="rotulo">{m}</span>
              <input
                className="campo px-2 py-1 text-sm"
                name={`consumo_${i}`}
                inputMode="decimal"
                defaultValue={inicial[i] ?? ''}
              />
            </label>
          ))}
        </div>
      ) : (
        <Campo
          rotulo="Consumo médio mensal (kWh)"
          nome="consumo_medio"
          inputMode="decimal"
          valor={inicial.length === 1 ? inicial[0] : ''}
        />
      )}
    </>
  )
}

export function FormularioNovoProjeto({
  clientes,
  concessionariaPadrao,
}: {
  clientes: { id: string; nome: string }[]
  concessionariaPadrao: string
}) {
  return (
    <FormularioAcao acao={criarProjetoSolar} className="space-y-2" rotuloBotao="Criar projeto">
      <Selecao
        rotulo="Cliente"
        nome="cliente_id"
        vazio="— selecione —"
        obrigatorio
        opcoes={clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))}
      />
      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Unidade consumidora" nome="uc" />
        <Campo rotulo="Concessionária" nome="concessionaria" valor={concessionariaPadrao} />
      </div>
      <Selecao
        rotulo="Tipo de ligação"
        nome="tipo_ligacao"
        valor="monofasica"
        opcoes={[
          { valor: 'monofasica', rotulo: 'Monofásica' },
          { valor: 'bifasica', rotulo: 'Bifásica' },
          { valor: 'trifasica', rotulo: 'Trifásica' },
        ]}
      />
      <Campo
        rotulo="Tarifa cheia (R$/kWh)"
        nome="tarifa"
        inputMode="decimal"
        placeholder="1,00"
        dica="Com impostos, como sai na conta"
      />
      <CamposConsumo projeto={null} />
      <div className="grid grid-cols-2 gap-2">
        <Selecao
          rotulo="Tipo de telhado"
          nome="tipo_telhado"
          vazio="— selecione —"
          opcoes={TELHADOS.map((t) => ({ valor: t, rotulo: t }))}
        />
        <Campo rotulo="Distância do quadro (m)" nome="distancia_quadro" inputMode="decimal" valor="20" />
      </div>
    </FormularioAcao>
  )
}

export function FormularioProjeto({
  projeto,
  clienteId,
}: {
  projeto: ProjetoSolar
  clienteId: string
}) {
  return (
    <FormularioAcao acao={salvarProjetoSolar} className="space-y-2" rotuloBotao="Salvar projeto">
      <input type="hidden" name="id" value={projeto.id} />

      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Unidade consumidora" nome="uc" valor={projeto.uc} />
        <Campo rotulo="Concessionária" nome="concessionaria" valor={projeto.concessionaria} />
      </div>
      <Selecao
        rotulo="Tipo de ligação"
        nome="tipo_ligacao"
        valor={projeto.tipo_ligacao}
        opcoes={[
          { valor: 'monofasica', rotulo: 'Monofásica' },
          { valor: 'bifasica', rotulo: 'Bifásica' },
          { valor: 'trifasica', rotulo: 'Trifásica' },
        ]}
      />
      <Campo
        rotulo="Tarifa cheia (R$/kWh)"
        nome="tarifa"
        inputMode="decimal"
        valor={formatarValor(projeto.tarifa)}
      />
      <CamposConsumo projeto={projeto} />
      <div className="grid grid-cols-2 gap-2">
        <Selecao
          rotulo="Tipo de telhado"
          nome="tipo_telhado"
          valor={projeto.tipo_telhado}
          vazio="— selecione —"
          opcoes={TELHADOS.map((t) => ({ valor: t, rotulo: t }))}
        />
        <Campo
          rotulo="Distância do quadro (m)"
          nome="distancia_quadro"
          inputMode="decimal"
          valor={projeto.distancia_quadro ?? ''}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Campo
          rotulo="Margem (%)"
          nome="margem"
          inputMode="decimal"
          valor={projeto.margem !== null ? String(projeto.margem * 100).replace('.', ',') : ''}
          dica="Nunca aparece na proposta"
        />
        <Selecao
          rotulo="Situação"
          nome="status"
          valor={projeto.status}
          opcoes={[
            { valor: 'rascunho', rotulo: 'Rascunho' },
            { valor: 'cotado', rotulo: 'Cotado' },
            { valor: 'enviado', rotulo: 'Proposta enviada' },
            { valor: 'fechado', rotulo: 'Fechado' },
            { valor: 'perdido', rotulo: 'Perdido' },
          ]}
        />
      </div>

      <div>
        <span className="rotulo">Conta de energia</span>
        <CapturaFoto
          bucket="arquivos"
          obraId={clienteId}
          pasta="contas-de-energia"
          nomeCampo="anexo"
          rotulo="Anexar conta de energia"
        />
      </div>
    </FormularioAcao>
  )
}
