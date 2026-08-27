'use client'

import { FormularioAcao } from '@/components/formulario'
import { salvarParametros } from './acoes'
import { formatarValor, lerNumero } from '@/lib/format'

const EM_CENTAVOS = new Set([
  'valor_quentinha_padrao',
  'solar_tarifa_fio_b',
  'solar_projeto_art',
  'solar_mao_obra_kwp',
])
const EM_PERCENTUAL = new Set([
  'percentual_meia_diaria',
  'percentual_rateio_parceiro',
  'margem_padrao',
  'bdi_padrao',
  'solar_margem',
])

interface Item {
  chave: string
  valor: string
  descricao: string | null
}

function valorParaCampo(item: Item): string {
  if (EM_CENTAVOS.has(item.chave)) return formatarValor(Number(item.valor) || 0)
  if (EM_PERCENTUAL.has(item.chave)) {
    const n = lerNumero(item.valor) ?? 0
    return String(n * 100).replace('.', ',')
  }
  return item.valor
}

function sufixo(chave: string): string | null {
  if (EM_CENTAVOS.has(chave)) return 'R$'
  if (EM_PERCENTUAL.has(chave)) return '%'
  return null
}

export function FormularioParametros({
  grupos,
}: {
  grupos: { titulo: string; descricao: string; itens: Item[] }[]
}) {
  return (
    <FormularioAcao acao={salvarParametros} rotuloBotao="Salvar parâmetros">
      <div className="space-y-4">
        {grupos.map((g) => (
          <div key={g.titulo}>
            <h3 className="text-sm font-bold text-rv-900 uppercase tracking-wide border-b border-slate-300 pb-1 mb-2">
              {g.titulo}
              {g.descricao && (
                <span className="ml-2 font-normal normal-case text-slate-500">— {g.descricao}</span>
              )}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {g.itens.map((item) => {
                const s = sufixo(item.chave)
                const longo = item.chave.startsWith('texto_') || item.chave === 'faixas_quentinha'
                return (
                  <label key={item.chave} className={longo ? 'sm:col-span-2' : ''}>
                    <span className="rotulo">
                      {item.chave}
                      {s && <span className="text-slate-400"> ({s})</span>}
                    </span>
                    {longo ? (
                      <textarea
                        className="campo"
                        name={`p_${item.chave}`}
                        rows={2}
                        defaultValue={valorParaCampo(item)}
                      />
                    ) : (
                      <input
                        className="campo"
                        name={`p_${item.chave}`}
                        defaultValue={valorParaCampo(item)}
                      />
                    )}
                    {item.descricao && (
                      <span className="block text-[11px] text-slate-500 mt-0.5">
                        {item.descricao}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </FormularioAcao>
  )
}
