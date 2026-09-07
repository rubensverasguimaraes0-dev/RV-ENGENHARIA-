import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { carregarAcumuladoDaObra, carregarFechamento } from '@/lib/dados/semana'
import { carregarParametros, dadosEmpresa } from '@/lib/parametros'
import { BarraImpressao } from '@/components/documento'
import { BotaoImprimir } from '@/components/botao-imprimir'
import { formatarData, formatarMoeda } from '@/lib/format'
import type { AbaDia } from '@/lib/domain/fechamento-semanal'

/**
 * Resumo semanal de diarias em UMA pagina A4 paisagem, no formato de
 * documentos/padrao/relatorios-de-diarias.md, secao 2 — o mesmo do PDF de
 * referencia Resumo_Semanal_Selecta_202507.pdf (842 x 595 pt).
 *
 * O layout e escrito em pt, e nao em classes utilitarias, porque o padrao
 * define medidas exatas (faixa de 34 pt, bloco de dia de 16 pt, total de
 * 17 pt) e o documento tem de caber numa pagina so.
 *
 * Semanas diferentes nunca somam entre si: o bloco "acumulado da obra" e a
 * unica coisa que olha para tras, e ele soma semanas fechadas, nao mistura.
 */
export default async function RelatorioSemanal({
  params,
}: {
  params: Promise<{ obraId: string; semanaId: string }>
}) {
  const { obraId, semanaId } = await params
  await exigirAdmin()

  const [obra, f, parametros, acumulado] = await Promise.all([
    carregarObra(obraId),
    carregarFechamento(obraId, semanaId),
    carregarParametros(),
    carregarAcumuladoDaObra(obraId),
  ])
  if (!obra || !f) notFound()

  const empresa = dadosEmpresa(parametros)

  // A grade tem 3 colunas: o que sobrar na ultima fileira vira o card de
  // observacoes. Semana de 6 dias fecha a grade e o card nao existe (padrao 2.3).
  const colunas = 3
  const vagas = (colunas - (f.dias.length % colunas)) % colunas
  const observacoes = observacoesDaSemana(f.dias, f.semana.dias_sem_expediente)

  // Preco de referencia para o dia que nao teve quentinha (sabado, por exemplo):
  // o padrao mostra "0 un. x R$ 22,00", e nao "x R$ 0,00".
  const precoDaSemana = f.faixas_quentinha[0]?.valor_unitario ?? 0

  return (
    <>
      <BarraImpressao>
        <Link href={`/obras/${obraId}/semanas/${semanaId}`} className="botao botao-neutro">
          Voltar
        </Link>
        <BotaoImprimir />
        <Link
          href={`/api/obras/${obraId}/semanas/${semanaId}/planilha`}
          className="botao botao-neutro"
        >
          Planilha (xlsx)
        </Link>
      </BarraImpressao>

      <style>{CSS}</style>

      <div className="rel">
        <header className="rel-topo">
          <div className="rel-topo-texto">
            <div className="rel-titulo">
              CONTROLE DE DIÁRIAS E CUSTOS DE MÃO DE OBRA — SEMANA{' '}
              {formatarData(f.semana.data_inicio).slice(0, 5)} A{' '}
              {formatarData(f.semana.data_fim)}
            </div>
            <div className="rel-subtitulo">
              Obra: {obra.nome}
              {obra.endereco ? `  ·  ${obra.endereco}` : ''}
            </div>
          </div>
          <div className="rel-marca">{empresa.nome.toUpperCase()}</div>
        </header>

        <div className="rel-grade">
          {f.dias.map((dia) => (
            <BlocoDoDia key={dia.data} dia={dia} precoDaSemana={precoDaSemana} />
          ))}

          {vagas > 0 && observacoes.length > 0 && (
            <section className="rel-bloco rel-card-obs" style={{ gridColumn: `span ${vagas}` }}>
              <div className="rel-faixa-dia">
                <span>OBSERVAÇÕES DA SEMANA</span>
              </div>
              <ul className="rel-obs-lista">
                {observacoes.map((o) => (
                  <li key={`${o.data}-${o.texto}`}>
                    <span className="rel-obs-data">{formatarData(o.data).slice(0, 5)}</span>
                    {o.texto}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="rel-faixa-resumo">RESUMO GERAL DA SEMANA</div>

        <div className="rel-colunas">
          <div className="rel-esquerda">
            <table className="rel-tabela">
              <thead>
                <tr>
                  <th colSpan={5} className="rel-th-secao">
                    GASTOS POR FUNCIONÁRIO
                  </th>
                </tr>
                <tr>
                  <th>FUNCIONÁRIO</th>
                  <th>FUNÇÃO</th>
                  <th className="dir">VALOR DA DIÁRIA</th>
                  <th className="cen">DIÁRIAS NA SEMANA</th>
                  <th className="dir">TOTAL A PAGAR</th>
                </tr>
              </thead>
              <tbody>
                {f.funcionarios.map((r) => (
                  <tr key={r.funcionario_id}>
                    <td>{r.nome}</td>
                    <td>{r.funcao}</td>
                    <td className="dir">{formatarMoeda(r.valor_diaria_padrao)}</td>
                    <td className="cen">{diarias(r.diarias)}</td>
                    <td className="dir">{formatarMoeda(r.total_diarias)}</td>
                  </tr>
                ))}
                <tr className="rel-subtotal">
                  <td colSpan={3}>TOTAL — MÃO DE OBRA DA SEMANA</td>
                  <td className="cen">{diarias(f.diarias)}</td>
                  <td className="dir">{formatarMoeda(f.total_mao_obra)}</td>
                </tr>
              </tbody>
            </table>

            <table className="rel-tabela rel-espaco">
              <thead>
                <tr>
                  <th colSpan={5} className="rel-th-secao">
                    ACUMULADO DA OBRA
                  </th>
                </tr>
                <tr>
                  <th>SEMANA</th>
                  <th className="cen">DIÁRIAS</th>
                  <th className="dir">MÃO DE OBRA</th>
                  <th className="dir">ALIMENTAÇÃO</th>
                  <th className="dir">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {acumulado.map((s) => (
                  <tr key={s.numero} className={s.numero === f.semana.numero ? 'rel-atual' : ''}>
                    <td>
                      Semana {s.numero} — {formatarData(s.data_inicio).slice(0, 5)} a{' '}
                      {formatarData(s.data_fim).slice(0, 5)}
                    </td>
                    <td className="cen">{diarias(s.diarias)}</td>
                    <td className="dir">{formatarMoeda(s.mao_obra)}</td>
                    <td className="dir">{formatarMoeda(s.alimentacao)}</td>
                    <td className="dir">{formatarMoeda(s.total)}</td>
                  </tr>
                ))}
                <tr className="rel-total-verde">
                  <td>TOTAL ACUMULADO DA OBRA</td>
                  <td className="cen">{diarias(somar(acumulado.map((s) => s.diarias)))}</td>
                  <td className="dir">{formatarMoeda(somar(acumulado.map((s) => s.mao_obra)))}</td>
                  <td className="dir">
                    {formatarMoeda(somar(acumulado.map((s) => s.alimentacao)))}
                  </td>
                  <td className="dir">{formatarMoeda(somar(acumulado.map((s) => s.total)))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rel-direita">
            <table className="rel-tabela">
              <thead>
                <tr>
                  <th colSpan={4} className="rel-th-secao">
                    QUENTINHAS — SEPARADO POR VALOR UNITÁRIO
                  </th>
                </tr>
                <tr>
                  <th className="dir">VALOR</th>
                  <th className="cen">DIAS</th>
                  <th className="cen">QTD.</th>
                  <th className="dir">CUSTO</th>
                </tr>
              </thead>
              <tbody>
                {f.faixas_quentinha.map((faixa) => (
                  <tr key={faixa.valor_unitario}>
                    <td className="dir">{formatarMoeda(faixa.valor_unitario)}</td>
                    <td className="cen">{diasComEssaFaixa(f.dias, faixa.valor_unitario)}</td>
                    <td className="cen">{faixa.quantidade}</td>
                    <td className="dir">{formatarMoeda(faixa.total)}</td>
                  </tr>
                ))}
                <tr className="rel-subtotal">
                  <td colSpan={2}>TOTAL DE QUENTINHAS DA SEMANA</td>
                  <td className="cen">{f.qtd_quentinhas}</td>
                  <td className="dir">{formatarMoeda(f.total_quentinhas)}</td>
                </tr>
              </tbody>
            </table>

            <div className="rel-linha-solta">
              <span>Total de mão de obra</span>
              <span>{formatarMoeda(f.total_mao_obra)}</span>
            </div>
            <div className="rel-linha-solta">
              <span>Total de alimentação</span>
              <span>{formatarMoeda(f.total_quentinhas)}</span>
            </div>

            <div className="rel-caixa-geral">
              <span>GASTO GERAL DA SEMANA</span>
              <span className="rel-valor-geral">{formatarMoeda(f.custo_semana)}</span>
            </div>
          </div>
        </div>

        <footer className="rel-rodape">
          <span>
            {empresa.nome} · Resp. téc. {empresa.responsavel} · Valores de diária e quentinha
            conforme informado pela obra · Emitido em {formatarData(hojeISO())}
          </span>
          <span>Página 1 de 1</span>
        </footer>
      </div>
    </>
  )
}

// -----------------------------------------------------------------------------

function BlocoDoDia({ dia, precoDaSemana }: { dia: AbaDia; precoDaSemana: number }) {
  const unitario = formatarMoeda(dia.quentinhas[0]?.valor_unitario ?? precoDaSemana)

  return (
    <section className="rel-bloco">
      <div className="rel-faixa-dia">
        <span>{dia.nome_dia.toUpperCase()}</span>
        <span>{formatarData(dia.data)}</span>
      </div>

      <div className="rel-cab-dia">
        <span className="c1">FUNCIONÁRIO</span>
        <span className="c2">FUNÇÃO</span>
        <span className="c3">DIÁRIAS</span>
        <span className="c4">VALOR</span>
      </div>

      <div className="rel-corpo-dia">
        {dia.linhas.map((l) => (
          <div className="rel-linha-dia" key={l.funcionario_id}>
            <span className="c1">{l.nome}</span>
            <span className="c2">{l.funcao}</span>
            <span className="c3">{diarias(l.fator_presenca)}</span>
            <span className="c4">{formatarMoeda(l.valor_diaria)}</span>
          </div>
        ))}
      </div>

      <div className="rel-sub-dia">
        <span>Subtotal mão de obra ({diarias(dia.diarias)} diárias)</span>
        <span>{formatarMoeda(dia.total_mao_obra)}</span>
      </div>
      <div className="rel-sub-dia">
        <span>
          Quentinhas: {dia.qtd_quentinhas} un. × {unitario}
        </span>
        <span>{formatarMoeda(dia.total_quentinhas)}</span>
      </div>

      {dia.sabado && (
        <div className="rel-obs-dia">Até meio-dia · diária integral · sem quentinha</div>
      )}

      <div className="rel-total-dia">
        <span>TOTAL DO DIA</span>
        <span>{formatarMoeda(dia.total_dia)}</span>
      </div>
    </section>
  )
}

// -----------------------------------------------------------------------------

/** 11.5 vira "11,5"; 9 vira "9"; 0,5 vira "0,5". */
function diarias(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}

function somar(valores: number[]): number {
  return valores.reduce((s, v) => s + v, 0)
}

/** Em quantos dias da semana aquele preco de quentinha foi praticado. */
function diasComEssaFaixa(dias: AbaDia[], valorUnitario: number): number {
  return dias.filter((d) => d.quentinhas.some((q) => q.valor_unitario === valorUnitario)).length
}

interface ObservacaoDatada {
  data: string
  texto: string
}

/**
 * Observacoes datadas da semana: o que foi anotado nos lancamentos mais os
 * dias sem expediente, que tambem sao informacao para quem le o relatorio.
 */
function observacoesDaSemana(dias: AbaDia[], semExpediente: string[]): ObservacaoDatada[] {
  const lista: ObservacaoDatada[] = []
  for (const dia of dias) {
    for (const texto of new Set(textosDoDia(dia))) lista.push({ data: dia.data, texto })
  }
  for (const data of semExpediente) lista.push({ data, texto: 'Sem expediente.' })
  return lista.sort((a, b) => a.data.localeCompare(b.data))
}

function textosDoDia(dia: AbaDia): string[] {
  return dia.linhas.map((l) => l.observacao).filter((t): t is string => Boolean(t && t.trim()))
}

function hojeISO(): string {
  const agora = new Date()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${agora.getFullYear()}-${mes}-${dia}`
}

// -----------------------------------------------------------------------------
// Medidas do padrao (secao 2). Em pt, para o documento fechar em uma pagina.
// -----------------------------------------------------------------------------

const CSS = `
@page { size: A4 landscape; margin: 26pt; }

.rel {
  width: 790pt;
  margin: 0 auto;
  padding: 12pt;
  background: #fff;
  color: #262626;
  font-family: Helvetica, Arial, sans-serif;
  font-size: 7pt;
  line-height: 1.25;
}
@media print { .rel { width: auto; padding: 0; } }

/* Cabecalho — faixa azul de 34 pt */
.rel-topo {
  height: 34pt;
  background: #1F3864;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8pt;
}
.rel-titulo { font-size: 11pt; font-weight: 700; letter-spacing: .01em; }
.rel-subtitulo { font-size: 7pt; margin-top: 1pt; }
.rel-marca { font-size: 9pt; font-weight: 700; white-space: nowrap; padding-left: 10pt; }

/* Grade de dias — 3 colunas, todas da mesma altura */
.rel-grade {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12pt;
  margin-top: 10pt;
}
.rel-bloco {
  display: flex;
  flex-direction: column;
  border: .5pt solid #BFBFBF;
}
.rel-faixa-dia {
  height: 16pt;
  background: #1F3864;
  color: #fff;
  font-size: 7.5pt;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 5pt;
}
.rel-cab-dia, .rel-linha-dia {
  display: grid;
  grid-template-columns: 42% 32% 12% 14%;
  align-items: center;
  padding: 0 5pt;
}
.rel-cab-dia {
  height: 12pt;
  background: #D9E1F2;
  color: #1F3864;
  font-size: 6pt;
  font-weight: 700;
}
.rel-linha-dia { height: 12pt; border-bottom: .4pt solid #BFBFBF; }
.rel-cab-dia .c3, .rel-linha-dia .c3 { text-align: center; }
.rel-cab-dia .c4, .rel-linha-dia .c4 { text-align: right; }
.rel-corpo-dia { flex: 1 1 auto; }

.rel-sub-dia {
  height: 13pt;
  background: #F2F2F2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 5pt;
  font-size: 6.4pt;
  border-top: .4pt solid #BFBFBF;
}
.rel-obs-dia {
  color: #C00000;
  font-style: italic;
  font-size: 6.2pt;
  padding: 1pt 5pt;
}
.rel-total-dia {
  height: 17pt;
  background: #C6E0B4;
  border-top: 1pt solid #1F3864;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 5pt;
  font-size: 9pt;
  font-weight: 700;
}

/* Card de observacoes, nas vagas que sobram na grade */
.rel-card-obs .rel-faixa-dia { justify-content: flex-start; }
.rel-obs-lista { margin: 0; padding: 5pt 8pt; list-style: none; font-size: 6.4pt; }
.rel-obs-lista li { margin-bottom: 3pt; }
.rel-obs-data { color: #1F3864; font-weight: 700; margin-right: 4pt; }

/* Resumo geral */
.rel-faixa-resumo {
  height: 15pt;
  background: #1F3864;
  color: #fff;
  font-size: 8pt;
  font-weight: 700;
  display: flex;
  align-items: center;
  padding: 0 8pt;
  margin-top: 12pt;
}
.rel-colunas { display: grid; grid-template-columns: 60% 40%; gap: 12pt; margin-top: 8pt; }

.rel-tabela { width: 100%; border-collapse: collapse; font-size: 6.6pt; }
.rel-espaco { margin-top: 10pt; }
.rel-tabela th, .rel-tabela td {
  border: .4pt solid #BFBFBF;
  padding: 2pt 4pt;
  text-align: left;
}
.rel-tabela thead th {
  background: #D9E1F2;
  color: #1F3864;
  font-size: 6pt;
  font-weight: 700;
}
.rel-th-secao {
  background: #1F3864 !important;
  color: #fff !important;
  font-size: 7pt !important;
  letter-spacing: .02em;
}
.rel-tabela .dir { text-align: right; }
.rel-tabela .cen { text-align: center; }
.rel-subtotal td { background: #F2F2F2; font-weight: 700; }
.rel-total-verde td { background: #C6E0B4; font-weight: 700; border-top: 1pt solid #1F3864; }
.rel-atual td { background: #F7F9FC; }

.rel-linha-solta {
  display: flex;
  justify-content: space-between;
  padding: 3pt 2pt;
  font-size: 7pt;
}
.rel-caixa-geral {
  margin-top: 4pt;
  background: #C6E0B4;
  border: 1.2pt solid #1F3864;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6pt 8pt;
  font-size: 8pt;
  font-weight: 700;
}
.rel-valor-geral { font-size: 11pt; }

.rel-rodape {
  margin-top: 12pt;
  display: flex;
  justify-content: space-between;
  color: #808080;
  font-style: italic;
  font-size: 6.5pt;
}
`
