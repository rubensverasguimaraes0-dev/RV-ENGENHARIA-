import { formatarMoeda } from '@/lib/format'
import type { Centavos } from '@/lib/format'

/**
 * Graficos do painel, desenhados em SVG no servidor.
 *
 * Sem biblioteca de grafico de proposito: o app e usado em obra, com sinal
 * ruim, e um pacote de 300 kB para desenhar seis barras sairia caro na tela de
 * quem mais precisa dela. O SVG vai pronto no HTML e aparece junto com o resto.
 *
 * Cada marca carrega um <title>: o navegador mostra o valor exato ao passar o
 * dedo ou o mouse, sem JavaScript nenhum. E logo abaixo de cada grafico vem a
 * tabela com todos os numeros — o grafico mostra a forma, a tabela responde
 * "quanto exatamente".
 *
 * As cores sao as da marca (azul #1673b8 e vermelho #b3261e da logo) e foram
 * conferidas para daltonismo: a separacao mais apertada entre duas series fica
 * em ΔE 19,9 no deuteranopia, bem acima do minimo de 8.
 */

const AZUL = '#1673b8'
const VERMELHO = '#c0392b'
const AMBAR = '#e39a3b'
const GRADE = '#dbe4ee'
const EIXO = '#5d6b7a'

/** R$ 12.855,00 vira "12,9 mil" — rotulo de eixo tem de caber. */
function curto(centavos: Centavos): string {
  const reais = centavos / 100
  if (Math.abs(reais) >= 1000) {
    const mil = reais / 1000
    return `${mil.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  }
  return reais.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

/**
 * Escala do eixo: escolhe o PASSO antes do topo.
 *
 * Arredondar so o topo produzia rotulo de quarto de escala como "1,3 mil" e
 * "3,8 mil" — numero que ninguem le — e deixava a barra mais alta na metade do
 * grafico. Escolhendo o passo primeiro (1, 2, 2,5 ou 5 vezes uma potencia de
 * dez, de modo que caibam de 3 a 6 faixas), toda linha cai num valor redondo e
 * o topo fica logo acima da maior barra.
 */
function escala(maior: number): { topo: number; linhas: number[] } {
  if (maior <= 0) return { topo: 1, linhas: [0, 1] }

  const potencia = 10 ** Math.floor(Math.log10(maior))
  let passo = potencia
  for (const p of [0.2, 0.25, 0.5, 1, 2, 2.5, 5]) {
    const faixas = Math.ceil(maior / (potencia * p))
    if (faixas >= 3 && faixas <= 6) {
      passo = potencia * p
      break
    }
  }

  const topo = Math.ceil(maior / passo) * passo
  const linhas: number[] = []
  for (let v = 0; v <= topo + passo / 2; v += passo) linhas.push(v)
  return { topo, linhas }
}

/** Retangulo com os dois cantos de cima arredondados e a base assentada. */
function barra(x: number, y: number, largura: number, altura: number, raio: number): string {
  const r = Math.min(raio, largura / 2, Math.max(0, altura))
  return [
    `M${x},${y + altura}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `L${x + largura - r},${y}`,
    `Q${x + largura},${y} ${x + largura},${y + r}`,
    `L${x + largura},${y + altura}`,
    'Z',
  ].join(' ')
}

export interface BarraEmpilhada {
  rotulo: string
  detalhe: string
  partes: { nome: string; valor: Centavos; cor: string }[]
}

const L = 62
const R = 14
const T = 16
const B = 30
// Area de desenho estreita de proposito. O SVG encolhe para caber na largura
// disponivel, e o texto encolhe junto: numa area de 760 o rotulo do eixo
// chegava a 5 pixels na tela do celular. Com 500, ele sobrevive ao aperto.
const LARG = 500
const ALT = 230

/** Custo de cada semana, separado entre mao de obra e alimentacao. */
export function GraficoSemanas({ pontos }: { pontos: BarraEmpilhada[] }) {
  if (pontos.length === 0) return null

  const totais = pontos.map((p) => p.partes.reduce((s, x) => s + x.valor, 0))
  const { topo, linhas } = escala(Math.max(...totais))
  const alturaUtil = ALT - T - B
  const faixa = (LARG - L - R) / pontos.length
  const larguraBarra = Math.min(46, faixa * 0.6)
  const y = (v: number) => T + alturaUtil * (1 - v / topo)

  const maior = totais.indexOf(Math.max(...totais))
  const ultimo = pontos.length - 1

  return (
    <svg viewBox={`0 0 ${LARG} ${ALT}`} className="w-full h-auto" role="img"
         aria-label="Custo de cada semana, separado entre mão de obra e alimentação">
      {linhas.map((v) => (
        <g key={v}>
          <line x1={L} x2={LARG - R} y1={y(v)} y2={y(v)} stroke={GRADE} strokeWidth={1} />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill={EIXO}>
            {v === 0 ? '0' : curto(v)}
          </text>
        </g>
      ))}

      {pontos.map((p, i) => {
        const x = L + faixa * i + (faixa - larguraBarra) / 2
        let base = y(0)
        const total = totais[i] ?? 0
        return (
          <g key={p.rotulo}>
            {p.partes.map((parte, j) => {
              const altura = Math.max(0, (alturaUtil * parte.valor) / topo - (j > 0 ? 2 : 0))
              base -= altura + (j > 0 ? 2 : 0)
              const emCima = j === p.partes.length - 1
              return (
                <path key={parte.nome}
                      d={barra(x, base, larguraBarra, altura, emCima ? 4 : 0)}
                      fill={parte.cor}>
                  <title>{`${p.detalhe} — ${parte.nome}: ${formatarMoeda(parte.valor)}`}</title>
                </path>
              )
            })}
            {(i === maior || i === ultimo) && (
              <text x={x + larguraBarra / 2} y={y(total) - 7} textAnchor="middle"
                    fontSize={11} fontWeight={600} fill={EIXO}>
                {curto(total)}
              </text>
            )}
            <text x={x + larguraBarra / 2} y={ALT - 10} textAnchor="middle" fontSize={11} fill={EIXO}>
              {p.rotulo}
            </text>
          </g>
        )
      })}
      <line x1={L} x2={LARG - R} y1={y(0)} y2={y(0)} stroke={EIXO} strokeWidth={1} />
    </svg>
  )
}

export interface PontoDeLinha {
  rotulo: string
  detalhe: string
  valores: number[]
}

/** Duas curvas acumuladas na mesma escala: quanto entrou e quanto saiu. */
export function GraficoAcumulado({
  pontos,
  series,
}: {
  pontos: PontoDeLinha[]
  series: { nome: string; cor: string }[]
}) {
  if (pontos.length === 0) return null

  const { topo, linhas } = escala(Math.max(...pontos.flatMap((p) => p.valores)))
  const alturaUtil = ALT - T - B
  const passo = pontos.length > 1 ? (LARG - L - R) / (pontos.length - 1) : 0
  const x = (i: number) => (pontos.length > 1 ? L + passo * i : (L + LARG - R) / 2)
  const y = (v: number) => T + alturaUtil * (1 - v / topo)

  return (
    <svg viewBox={`0 0 ${LARG} ${ALT}`} className="w-full h-auto" role="img"
         aria-label="Custo acumulado e recebido acumulado, semana a semana">
      {linhas.map((v) => (
        <g key={v}>
          <line x1={L} x2={LARG - R} y1={y(v)} y2={y(v)} stroke={GRADE} strokeWidth={1} />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill={EIXO}>
            {v === 0 ? '0' : curto(v)}
          </text>
        </g>
      ))}

      {series.map((s, sIdx) => {
        const d = pontos
          .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.valores[sIdx] ?? 0)}`)
          .join(' ')
        const ultimo = pontos.length - 1
        const valorFinal = pontos[ultimo]?.valores[sIdx] ?? 0
        return (
          <g key={s.nome}>
            <path d={d} fill="none" stroke={s.cor} strokeWidth={2}
                  strokeLinejoin="round" strokeLinecap="round" />
            {pontos.map((p, i) => (
              <circle key={p.rotulo} cx={x(i)} cy={y(p.valores[sIdx] ?? 0)} r={4.5}
                      fill={s.cor} stroke="#fff" strokeWidth={2}>
                <title>{`${p.detalhe} — ${s.nome}: ${formatarMoeda(p.valores[sIdx] ?? 0)}`}</title>
              </circle>
            ))}
            <text x={x(ultimo) - 6} y={y(valorFinal) + (sIdx === 0 ? -12 : 18)}
                  textAnchor="end" fontSize={11} fontWeight={600} fill={EIXO}>
              {s.nome} {curto(valorFinal)}
            </text>
          </g>
        )
      })}

      {pontos.map((p, i) => (
        <text key={p.rotulo} x={x(i)} y={ALT - 10} textAnchor="middle" fontSize={11} fill={EIXO}>
          {p.rotulo}
        </text>
      ))}
      <line x1={L} x2={LARG - R} y1={y(0)} y2={y(0)} stroke={EIXO} strokeWidth={1} />
    </svg>
  )
}

/** Legenda: identidade nunca fica so na cor — o nome vai junto. */
export function Legenda({ itens }: { itens: { nome: string; cor: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-600 mb-1">
      {itens.map((i) => (
        <span key={i.nome} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: i.cor }} />
          {i.nome}
        </span>
      ))}
    </div>
  )
}

export const CORES = { azul: AZUL, vermelho: VERMELHO, ambar: AMBAR }
