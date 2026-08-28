'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { marcarPresenca, removerPresenca, salvarQuentinha } from './acoes'
import { useAvisos } from '@/components/avisos'
import { formatarMoeda, formatarValor, lerMoeda } from '@/lib/format'
import type { TipoDiaria } from '@/lib/domain/tipos'

export interface PessoaDoDia {
  id: string
  nome: string
  funcao: string | null
  tipo: 'funcionario' | 'parceiro'
  /** null para o lancador — ele nao ve valor de diaria. */
  valor_diaria: number | null
  presente: boolean
  tipo_diaria: TipoDiaria
  valor_lancado: number | null
  valor_vale: number
}

const OPCOES: { valor: TipoDiaria; curto: string; titulo: string }[] = [
  { valor: 'cheia', curto: 'Cheia', titulo: 'Diária cheia' },
  { valor: 'meia', curto: 'Meia', titulo: 'Meia diária — chegou fora do horário' },
  { valor: 'sem_diaria', curto: 'Sem', titulo: 'Sem diária — conta presença e quentinha' },
]

export function ListaPresenca({
  obraId,
  data,
  pessoas,
  mostrarValores,
  semanaFechada,
}: {
  obraId: string
  data: string
  pessoas: PessoaDoDia[]
  mostrarValores: boolean
  semanaFechada: boolean
}) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [emFoco, setEmFoco] = useState<string | null>(null)
  // Qual linha esta gravando agora. Sem isto, um toque trava a lista inteira
  // sem dizer em quem — e a pessoa toca de novo.
  const [gravando, setGravando] = useState<string | null>(null)
  const { avisar } = useAvisos()

  function agir(id: string, fn: () => Promise<{ erro?: string; ok?: string }>) {
    setErro(null)
    setGravando(id)
    iniciar(async () => {
      const r = await fn()
      if (r.erro) {
        setErro(r.erro)
        avisar(r.erro, 'erro')
      }
      setGravando(null)
      router.refresh()
    })
  }

  const presentes = pessoas.filter((p) => p.presente)
  const totalMaoObra = presentes.reduce((s, p) => s + (p.valor_lancado ?? 0), 0)
  const totalVales = presentes.reduce((s, p) => s + p.valor_vale, 0)

  return (
    <div>
      {erro && (
        <p className="mb-2 text-sm rounded border border-erro-700/30 bg-erro-100 text-erro-700 px-3 py-2">
          {erro}
        </p>
      )}

      <ul className="divide-y divide-slate-200">
        {pessoas.map((p) => (
          <li key={p.id} className={p.presente ? 'bg-ok-100/40' : ''}>
            <div className="flex items-center gap-2 py-2 px-1">
              <button
                type="button"
                disabled={pendente || semanaFechada}
                onClick={() =>
                  agir(p.id, () =>
                    p.presente
                      ? removerPresenca({ obraId, funcionarioId: p.id, data })
                      : marcarPresenca({
                          obraId,
                          funcionarioId: p.id,
                          data,
                          tipo: p.tipo === 'parceiro' ? 'sem_diaria' : 'cheia',
                        }),
                  )
                }
                className={`h-12 w-12 shrink-0 rounded-lg border-2 text-xl font-bold grid place-items-center transition-colors ${
                  p.presente
                    ? 'bg-ok-700 border-ok-700 text-white'
                    : 'bg-white border-slate-300 text-slate-400'
                } ${gravando === p.id ? 'opacity-70' : ''}`}
                aria-pressed={p.presente}
                aria-busy={gravando === p.id}
                aria-label={p.presente ? `Remover ${p.nome}` : `Marcar ${p.nome}`}
              >
                {gravando === p.id ? (
                  <span className="girando" style={{ borderTopColor: p.presente ? '#fff' : '#0b4f8a' }} />
                ) : p.presente ? (
                  '✓'
                ) : (
                  '+'
                )}
              </button>

              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">
                  {p.nome}
                  {p.tipo === 'parceiro' && (
                    <span className="ml-2 etiqueta etiqueta-alerta">Parceiro</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  {p.funcao ?? '—'}
                  {mostrarValores && p.valor_diaria !== null && (
                    <> · diária {formatarMoeda(p.valor_diaria)}</>
                  )}
                </div>
              </div>

              {p.presente && (
                <div className="flex items-center gap-1">
                  {OPCOES.map((o) => (
                    <button
                      key={o.valor}
                      type="button"
                      title={o.titulo}
                      disabled={pendente || semanaFechada}
                      onClick={() =>
                        agir(p.id, () =>
                          marcarPresenca({
                            obraId,
                            funcionarioId: p.id,
                            data,
                            tipo: o.valor,
                            vale: p.valor_vale,
                          }),
                        )
                      }
                      className={`h-10 min-w-[3rem] px-2 rounded border text-xs font-bold ${
                        p.tipo_diaria === o.valor
                          ? 'bg-rv-800 border-rv-800 text-white'
                          : 'bg-white border-slate-300 text-slate-600'
                      }`}
                    >
                      {o.curto}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {p.presente && (
              <div className="pb-2 pl-14 pr-1 flex flex-wrap items-center gap-3 text-xs">
                {mostrarValores && (
                  <span className="text-slate-600">
                    lançado: <strong>{formatarMoeda(p.valor_lancado ?? 0)}</strong>
                  </span>
                )}
                {emFoco === p.id ? (
                  <ValeInline
                    inicial={p.valor_vale}
                    onSalvar={(centavos) => {
                      setEmFoco(null)
                      agir(p.id, () =>
                        marcarPresenca({
                          obraId,
                          funcionarioId: p.id,
                          data,
                          tipo: p.tipo_diaria,
                          vale: centavos,
                        }),
                      )
                    }}
                    onCancelar={() => setEmFoco(null)}
                  />
                ) : (
                  <button
                    type="button"
                    className="acao acao-neutra"
                    disabled={semanaFechada}
                    onClick={() => setEmFoco(p.id)}
                  >
                    {p.valor_vale > 0 ? `vale ${formatarMoeda(p.valor_vale)}` : 'lançar vale'}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {mostrarValores && (
        <div className="mt-3 border-t-2 border-rv-800 pt-2 text-sm flex flex-wrap gap-4 bg-rv-50 -mx-3 -mb-3 px-3 py-2">
          <span>
            Presentes: <strong>{presentes.length}</strong>
          </span>
          <span>
            Mão de obra do dia: <strong>{formatarMoeda(totalMaoObra)}</strong>
          </span>
          {totalVales > 0 && (
            <span>
              Vales: <strong>{formatarMoeda(totalVales)}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function ValeInline({
  inicial,
  onSalvar,
  onCancelar,
}: {
  inicial: number
  onSalvar: (centavos: number) => void
  onCancelar: () => void
}) {
  const [texto, setTexto] = useState(inicial > 0 ? formatarValor(inicial) : '')
  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        className="campo h-8 w-24 py-0 text-sm"
        inputMode="decimal"
        placeholder="0,00"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSalvar(lerMoeda(texto) ?? 0)
          if (e.key === 'Escape') onCancelar()
        }}
      />
      <button type="button" className="botao botao-primario h-8 py-0" onClick={() => onSalvar(lerMoeda(texto) ?? 0)}>
        ok
      </button>
      <button type="button" className="text-slate-500 underline" onClick={onCancelar}>
        cancelar
      </button>
    </span>
  )
}

export function BlocoQuentinhas({
  obraId,
  data,
  faixas,
  valorPadrao,
  sugerirQuentinha,
  registros,
  semanaFechada,
}: {
  obraId: string
  data: string
  faixas: number[]
  valorPadrao: number
  sugerirQuentinha: boolean
  registros: { quantidade: number; valor_unitario: number }[]
  semanaFechada: boolean
}) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [valorUnitario, setValorUnitario] = useState(formatarValor(valorPadrao))
  const [quantidade, setQuantidade] = useState('')

  const total = registros.reduce((s, r) => s + r.quantidade * r.valor_unitario, 0)
  const qtd = registros.reduce((s, r) => s + r.quantidade, 0)

  function salvar(q: number, v: number) {
    setErro(null)
    iniciar(async () => {
      const r = await salvarQuentinha({ obraId, data, quantidade: q, valorUnitario: v })
      if (r.erro) setErro(r.erro)
      router.refresh()
    })
  }

  return (
    <div>
      {!sugerirQuentinha && registros.length === 0 && (
        <p className="mb-2 text-xs rounded border border-alerta-700/30 bg-alerta-100 text-alerta-700 px-2 py-1.5">
          Sábado: a obra trabalha até meio-dia, sem quentinha. A diária sai integral. Se houve
          quentinha mesmo assim, lance abaixo.
        </p>
      )}

      {registros.length > 0 && (
        <table className="tabela mb-2">
          <thead>
            <tr>
              <th className="num">Qtd.</th>
              <th className="num">Valor unit.</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((r) => (
              <tr key={r.valor_unitario}>
                <td className="num">{r.quantidade}</td>
                <td className="num">{formatarMoeda(r.valor_unitario)}</td>
                <td className="num">{formatarMoeda(r.quantidade * r.valor_unitario)}</td>
              </tr>
            ))}
            <tr className="total">
              <td className="num">{qtd}</td>
              <td></td>
              <td className="num">{formatarMoeda(total)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {erro && <p className="mb-2 text-sm text-erro-700">{erro}</p>}

      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="rotulo">Quantidade</span>
          <input
            className="campo w-24"
            inputMode="numeric"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            placeholder="0"
          />
        </label>
        <label className="block">
          <span className="rotulo">Valor unitário</span>
          <input
            className="campo w-28"
            inputMode="decimal"
            value={valorUnitario}
            onChange={(e) => setValorUnitario(e.target.value)}
            list="faixas-quentinha"
          />
          <datalist id="faixas-quentinha">
            {faixas.map((f) => (
              <option key={f} value={formatarValor(f)} />
            ))}
          </datalist>
        </label>
        <button
          type="button"
          className="botao botao-primario"
          disabled={pendente || semanaFechada}
          onClick={() => salvar(Number(quantidade || 0), lerMoeda(valorUnitario) ?? valorPadrao)}
        >
          Registrar
        </button>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        A quantidade não precisa bater com o número de presentes — às vezes sai uma a mais. O valor
        unitário muda com a troca de fornecedor e o fechamento separa por faixa.
      </p>
    </div>
  )
}
