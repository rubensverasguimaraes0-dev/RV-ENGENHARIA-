'use client'

import { useMemo, useState } from 'react'
import {
  calcularEconomia,
  dimensionar,
  projetar25Anos,
  type ParametrosSolar,
  type TipoLigacao,
} from '@/lib/domain/solar'
import { formatarMoeda, formatarNumero, lerMoeda, lerNumero } from '@/lib/format'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function CalculadoraSolar({
  parametros,
  percentualFioBAno,
  tarifaFioB,
}: {
  parametros: ParametrosSolar
  percentualFioBAno: number
  tarifaFioB: number
}) {
  const [porMes, setPorMes] = useState(false)
  const [media, setMedia] = useState('500')
  const [meses, setMeses] = useState<string[]>(Array(12).fill(''))
  const [ligacao, setLigacao] = useState<TipoLigacao>('monofasica')
  const [tarifa, setTarifa] = useState('1,00')
  const [potenciaModulo, setPotenciaModulo] = useState('610')
  const [areaModulo, setAreaModulo] = useState('2,79')
  const [investimento, setInvestimento] = useState('')

  const consumo = useMemo(() => {
    if (!porMes) {
      const m = lerNumero(media)
      return m === null ? [] : [m]
    }
    return meses.map((m) => lerNumero(m)).filter((n): n is number => n !== null)
  }, [porMes, media, meses])

  const d = useMemo(
    () =>
      dimensionar({
        consumo_mensal: consumo,
        tipo_ligacao: ligacao,
        potencia_modulo_wp: lerNumero(potenciaModulo) ?? 610,
        area_modulo_m2: lerNumero(areaModulo) ?? 2.79,
        parametros,
      }),
    [consumo, ligacao, potenciaModulo, areaModulo, parametros],
  )

  const entradaEconomia = {
    dimensionamento: d,
    tarifa: lerMoeda(tarifa) ?? 0,
    tarifa_fio_b: tarifaFioB,
    percentual_fio_b: percentualFioBAno,
    investimento_total: lerMoeda(investimento) ?? 0,
  }
  const economia = calcularEconomia(entradaEconomia)
  const projecao = useMemo(
    () => (d.qtd_modulos > 0 ? projetar25Anos(entradaEconomia, parametros.degradacao_anual) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, tarifa, investimento, percentualFioBAno, tarifaFioB, parametros.degradacao_anual],
  )

  return (
    <div className="grid gap-3 lg:grid-cols-[360px_1fr]">
      <section className="cartao overflow-hidden">
        <div className="cartao-titulo">Dados da conta de energia</div>
        <div className="p-3 space-y-2">
          <label className="block">
            <span className="rotulo">Tipo de ligação</span>
            <select
              className="campo"
              value={ligacao}
              onChange={(e) => setLigacao(e.target.value as TipoLigacao)}
            >
              <option value="monofasica">Monofásica — {parametros.custo_disponibilidade.monofasica} kWh</option>
              <option value="bifasica">Bifásica — {parametros.custo_disponibilidade.bifasica} kWh</option>
              <option value="trifasica">Trifásica — {parametros.custo_disponibilidade.trifasica} kWh</option>
            </select>
          </label>

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
                    inputMode="decimal"
                    value={meses[i] ?? ''}
                    onChange={(e) => {
                      const novos = [...meses]
                      novos[i] = e.target.value
                      setMeses(novos)
                    }}
                  />
                </label>
              ))}
            </div>
          ) : (
            <label className="block">
              <span className="rotulo">Consumo médio mensal (kWh)</span>
              <input
                className="campo"
                inputMode="decimal"
                value={media}
                onChange={(e) => setMedia(e.target.value)}
              />
            </label>
          )}

          <label className="block">
            <span className="rotulo">Tarifa cheia (R$/kWh, com impostos)</span>
            <input
              className="campo"
              inputMode="decimal"
              value={tarifa}
              onChange={(e) => setTarifa(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="rotulo">Módulo (Wp)</span>
              <input
                className="campo"
                inputMode="decimal"
                value={potenciaModulo}
                onChange={(e) => setPotenciaModulo(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="rotulo">Área do módulo (m²)</span>
              <input
                className="campo"
                inputMode="decimal"
                value={areaModulo}
                onChange={(e) => setAreaModulo(e.target.value)}
              />
            </label>
          </div>

          <label className="block">
            <span className="rotulo">Investimento previsto (para o payback)</span>
            <input
              className="campo"
              inputMode="decimal"
              placeholder="25.000,00"
              value={investimento}
              onChange={(e) => setInvestimento(e.target.value)}
            />
          </label>

          <p className="text-[11px] text-slate-500">
            HSP {formatarNumero(parametros.hsp, 1)} kWh/m²·dia · performance ratio{' '}
            {formatarNumero(parametros.performance_ratio, 2)} · Fio B{' '}
            {formatarNumero(percentualFioBAno * 100, 0)}% — tudo ajustável em Parâmetros.
          </p>
        </div>
      </section>

      <div className="space-y-3">
        {d.aviso ? (
          <p className="rounded border border-alerta-700/40 bg-alerta-100 text-alerta-700 px-3 py-2 text-sm font-medium">
            {d.aviso}
          </p>
        ) : (
          <>
            <section className="cartao overflow-hidden">
              <div className="cartao-titulo">Sistema dimensionado</div>
              <div className="p-3">
                <table className="tabela">
                  <tbody>
                    <tr className="secao">
                      <td colSpan={2}>Consumo</td>
                    </tr>
                    <L r="Consumo médio mensal" v={`${formatarNumero(d.consumo_medio_mensal, 0)} kWh`} />
                    <L r="Custo de disponibilidade" v={`${d.custo_disponibilidade} kWh`} />
                    <L r="Energia a compensar" v={`${formatarNumero(d.energia_a_compensar, 0)} kWh/mês`} />
                    <tr className="secao">
                      <td colSpan={2}>Sistema</td>
                    </tr>
                    <L r="Potência necessária" v={`${formatarNumero(d.potencia_kwp_necessaria, 2)} kWp`} />
                    <L r="Quantidade de módulos" v={String(d.qtd_modulos)} />
                    <L r="Potência instalada" v={`${formatarNumero(d.potencia_instalada_kwp, 2)} kWp`} />
                    <L r="Inversor sugerido" v={`${formatarNumero(d.potencia_inversor_kw, 2)} kW`} />
                    <L r="Área necessária" v={`${formatarNumero(d.area_necessaria_m2, 2)} m²`} />
                    <tr className="secao">
                      <td colSpan={2}>Geração</td>
                    </tr>
                    <L r="Geração mensal estimada" v={`${formatarNumero(d.geracao_mensal_estimada, 0)} kWh`} />
                    <L r="Energia compensada" v={`${formatarNumero(d.energia_compensada, 0)} kWh/mês`} />
                    <tr className="total">
                      <td>Cobertura do consumo</td>
                      <td className="num">{formatarNumero(d.cobertura_consumo * 100, 0)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="cartao overflow-hidden">
              <div className="cartao-titulo">Economia e retorno</div>
              <div className="p-3">
                <table className="tabela">
                  <tbody>
                    <L r="Economia bruta por mês" v={formatarMoeda(economia.economia_bruta_mes)} />
                    <L r="Fio B (Lei 14.300)" v={`- ${formatarMoeda(economia.fio_b_mes)}`} />
                    <tr className="subtotal">
                      <td>Economia líquida por mês</td>
                      <td className="num">{formatarMoeda(economia.economia_liquida_mes)}</td>
                    </tr>
                    <L r="Economia no primeiro ano" v={formatarMoeda(economia.economia_ano_1)} />
                    <tr className="total">
                      <td>Payback</td>
                      <td className="num">
                        {economia.payback_anos === null
                          ? 'informe o investimento'
                          : `${formatarNumero(economia.payback_anos, 1)} anos`}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {projecao.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-rv-700">
                      Projeção de 25 anos com degradação dos módulos
                    </summary>
                    <table className="tabela mt-2">
                      <thead>
                        <tr>
                          <th>Ano</th>
                          <th className="num">Geração (kWh)</th>
                          <th className="num">Economia</th>
                          <th className="num">Acumulado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projecao.map((p) => (
                          <tr key={p.ano}>
                            <td>{p.ano}</td>
                            <td className="num">{formatarNumero(p.geracao_kwh, 0)}</td>
                            <td className="num">{formatarMoeda(p.economia)}</td>
                            <td className="num">{formatarMoeda(p.acumulado)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function L({ r, v }: { r: string; v: string }) {
  return (
    <tr>
      <td>{r}</td>
      <td className="num">{v}</td>
    </tr>
  )
}
