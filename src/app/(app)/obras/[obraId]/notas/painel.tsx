'use client'

import { useState } from 'react'
import { FormularioAcao, Campo, Selecao, Marcador } from '@/components/formulario'
import { marcarRepassadas, salvarDespesa, salvarRateio } from './acoes'
import { formatarMoeda, formatarValor, hojeISO, lerMoeda } from '@/lib/format'

export function PainelRepasse({
  obraId,
  notas,
}: {
  obraId: string
  notas: { id: string; rotulo: string; valor: number; temFoto: boolean }[]
}) {
  if (notas.length === 0) {
    return <p className="text-sm text-slate-600">Nenhuma nota pendente de repasse.</p>
  }

  const semFoto = notas.filter((n) => !n.temFoto)

  return (
    <FormularioAcao acao={marcarRepassadas} rotuloBotao="Marcar como repassadas">
      <input type="hidden" name="obra_id" value={obraId} />
      <Campo rotulo="Data do repasse" nome="repassada_em" tipo="date" valor={hojeISO()} />

      {semFoto.length > 0 && (
        <p className="my-2 text-xs rounded border border-erro-700/30 bg-erro-100 text-erro-700 px-2 py-1.5">
          {semFoto.length} nota(s) ainda sem foto. Anexe a foto antes de enviar o relatório ao
          cliente.
        </p>
      )}

      <ul className="mt-2 max-h-64 overflow-y-auto space-y-1">
        {notas.map((n) => (
          <li key={n.id}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="nota_id" value={n.id} defaultChecked className="h-4 w-4" />
              <span className="flex-1">{n.rotulo}</span>
              <span className="tabular-nums">{formatarMoeda(n.valor)}</span>
              {!n.temFoto && <span className="etiqueta etiqueta-erro">sem foto</span>}
            </label>
          </li>
        ))}
      </ul>
    </FormularioAcao>
  )
}

export function FormularioDespesa({
  obraId,
  locais,
}: {
  obraId: string
  locais: { id: string; nome: string }[]
}) {
  return (
    <FormularioAcao acao={salvarDespesa} className="space-y-2" rotuloBotao="Lançar despesa">
      <input type="hidden" name="obra_id" value={obraId} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Campo rotulo="Data" nome="data" tipo="date" valor={hojeISO()} />
        <Campo rotulo="Valor" nome="valor" inputMode="decimal" placeholder="60,00" obrigatorio />
      </div>
      <Campo
        rotulo="Descrição"
        nome="descricao"
        obrigatorio
        placeholder="chumbadores com o metalúrgico"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <Campo rotulo="Pago a" nome="pago_a" placeholder="metalúrgico" />
        <Selecao
          rotulo="Categoria"
          nome="categoria"
          valor="material"
          opcoes={[
            { valor: 'material', rotulo: 'Material' },
            { valor: 'terceiro', rotulo: 'Serviço de terceiro' },
            { valor: 'locacao', rotulo: 'Locação' },
            { valor: 'cacamba', rotulo: 'Caçamba' },
            { valor: 'combustivel', rotulo: 'Combustível' },
            { valor: 'outro', rotulo: 'Outro' },
          ]}
        />
      </div>
      {locais.length > 0 && (
        <Selecao
          rotulo="Local"
          nome="local_id"
          vazio="— obra inteira —"
          opcoes={locais.map((l) => ({ valor: l.id, rotulo: l.nome }))}
        />
      )}
      <Marcador
        rotulo="Repassar ao cliente"
        nome="repassar_cliente"
        dica="Por padrão a despesa sem nota entra só no custo da obra, nunca no valor a repassar."
      />
    </FormularioAcao>
  )
}

export function FormularioRateio({
  obraId,
  nota,
  locais,
  rateioAtual,
}: {
  obraId: string
  nota: { id: string; valor: number }
  locais: { id: string; nome: string }[]
  rateioAtual: { local_id: string | null; valor: number }[]
}) {
  const inicial = new Map(rateioAtual.filter((r) => r.local_id).map((r) => [r.local_id!, r.valor]))
  const [partes, setPartes] = useState<Record<string, string>>(
    Object.fromEntries(locais.map((l) => [l.id, inicial.has(l.id) ? formatarValor(inicial.get(l.id)!) : ''])),
  )

  const soma = Object.values(partes).reduce((s, v) => s + (lerMoeda(v) ?? 0), 0)
  const diferenca = nota.valor - soma
  const preenchidas = Object.values(partes).some((v) => (lerMoeda(v) ?? 0) > 0)

  return (
    <FormularioAcao acao={salvarRateio} rotuloBotao="Salvar rateio">
      <input type="hidden" name="nota_id" value={nota.id} />
      <input type="hidden" name="obra_id" value={obraId} />
      <input type="hidden" name="valor_nota" value={formatarValor(nota.valor)} />

      <div className="grid gap-2 sm:grid-cols-2">
        {locais.map((l) => (
          <label key={l.id} className="block">
            <span className="rotulo">{l.nome}</span>
            <input
              className="campo"
              name={`parte_${l.id}`}
              inputMode="decimal"
              placeholder="0,00"
              value={partes[l.id] ?? ''}
              onChange={(e) => setPartes({ ...partes, [l.id]: e.target.value })}
            />
          </label>
        ))}
      </div>

      <p
        className={`mt-2 text-sm font-medium ${
          !preenchidas ? 'text-slate-600' : diferenca === 0 ? 'text-ok-700' : 'text-erro-700'
        }`}
      >
        {!preenchidas
          ? 'Deixe tudo em branco para remover o rateio e manter a nota inteira no local original.'
          : diferenca === 0
            ? `As partes fecham com o valor da nota (${formatarMoeda(nota.valor)}).`
            : `Faltam ${formatarMoeda(diferenca)} para fechar o valor da nota.`}
      </p>
    </FormularioAcao>
  )
}
