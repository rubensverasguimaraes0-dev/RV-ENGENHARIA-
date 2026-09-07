import { Fragment } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { listarParcelas, type ParcelaComComprovante } from '@/lib/dados/pagamentos'
import { carregarParametros, dadosEmpresa } from '@/lib/parametros'
import {
  agruparPorMes,
  parcelasParaAnexar,
  resumirCronograma,
  statusDaParcela,
  valorEfetivo,
} from '@/lib/domain/pagamentos'
import { BarraImpressao } from '@/components/documento'
import { BotaoImprimir } from '@/components/botao-imprimir'
import {
  diaDaSemana,
  formatarData,
  formatarMoeda,
  formatarPercentual,
  hojeISO,
  type DataISO,
} from '@/lib/format'
import type { DadosEmpresa } from '@/lib/parametros'

/**
 * Cronograma fisico-financeiro no formato de
 * documentos/padrao/relatorios-de-cliente.md, secoes 2 e 3.1 — o mesmo do
 * Cronograma_Fisico_Financeiro_Selecta_Gil_Martins.pdf (A4 retrato).
 *
 * A ordem vertical e fixa: faixa navy com a marca, barra azul com o nome do
 * documento, bloco de dados, painel de indicadores, tabela com faixas de mes,
 * como acompanhar, observacoes numeradas e assinatura. Os comprovantes vem
 * depois, um por pagina.
 *
 * Vencimento e data efetiva de pagamento sao colunas distintas (padrao 3.1.8):
 * a coluna de vencimento guarda o previsto mesmo quando o Pix caiu noutro dia,
 * e a data real aparece na observacao.
 */
export default async function RelatorioCronograma({
  params,
}: {
  params: Promise<{ obraId: string }>
}) {
  const { obraId } = await params
  await exigirAdmin()

  const [obra, parametros] = await Promise.all([carregarObra(obraId), carregarParametros()])
  if (!obra) notFound()

  const parcelas = await listarParcelas(obraId)
  const hoje = hojeISO()
  const resumo = resumirCronograma(parcelas, obra.valor_contrato, hoje)
  const empresa = dadosEmpresa(parametros)
  const cliente = obra.pagador ?? obra.cliente
  const comComprovante = parcelasParaAnexar(parcelas)
  const meses = agruparPorMes(parcelas)

  // Acumulado e saldo devedor sao calculados na ordem das parcelas, e nao por
  // mes: o balao da ultima parcela e o que faz o saldo fechar em zero.
  const acumuladoPorId = new Map<string, { acumulado: number; saldo: number }>()
  let corrido = 0
  for (const p of [...parcelas].sort((a, b) => a.numero_parcela - b.numero_parcela)) {
    corrido += p.valor_previsto
    acumuladoPorId.set(p.id, { acumulado: corrido, saldo: obra.valor_contrato - corrido })
  }

  const quantidade = parcelas.length
  const baloes = parcelas.filter((p) => p.balao).length
  const observacoes = observacoesDoCronograma(parcelas, obra.valor_contrato, hoje)

  return (
    <>
      <BarraImpressao>
        <Link href={`/obras/${obraId}/pagamentos`} className="botao botao-neutro">
          Voltar
        </Link>
        <BotaoImprimir />
      </BarraImpressao>

      <style>{CSS}</style>

      <div className="cro">
        <FaixaDaMarca empresa={empresa} />

        <div className="cro-barra-titulo">CRONOGRAMA FÍSICO-FINANCEIRO — ADIANTAMENTOS</div>

        <table className="cro-dados">
          <tbody>
            <tr>
              <th>OBRA:</th>
              <td>{obra.nome}</td>
              <th>REGIME:</th>
              <td>{regimeLegivel(obra.forma_contratacao)}</td>
            </tr>
            <tr>
              <th>CLIENTE:</th>
              <td>{cliente?.nome ?? '—'}</td>
              <th>LOCAL:</th>
              <td>{obra.endereco ?? '—'}</td>
            </tr>
            <tr>
              <th>RESPONSÁVEL:</th>
              <td>{empresa.responsavel}</td>
              <th>PARCELAS:</th>
              <td>
                {quantidade}
                {baloes > 0 ? ` (${quantidade - baloes} adiantamentos + balão)` : ''}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="cro-painel">
          <Cartao rotulo="VALOR TOTAL DA OBRA" valor={formatarMoeda(obra.valor_contrato)} />
          <Cartao
            rotulo="TOTAL PAGO"
            valor={formatarMoeda(resumo.total_recebido_nesta_obra)}
            tom="verde"
          />
          <Cartao rotulo="SALDO A PAGAR" valor={formatarMoeda(resumo.saldo_contrato)} />
          <Cartao rotulo="% QUITADO" valor={formatarPercentual(resumo.percentual_quitado, 1)} />
        </div>

        <table className="cro-tabela">
          <thead>
            <tr>
              <th>Parcela</th>
              <th>Vencimento</th>
              <th>Dia</th>
              <th className="dir">Valor (R$)</th>
              <th className="dir">Acumulado (R$)</th>
              <th className="dir">Saldo Devedor (R$)</th>
              <th className="cen">Pago</th>
              <th>Forma de Pgto.</th>
              <th className="cen">Status</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((mes) => (
              <Fragment key={mes.chave || 'sem-vencimento'}>
                <tr className="cro-faixa-mes">
                  <td colSpan={9}>{mes.rotulo}</td>
                </tr>
                {mes.parcelas.map((p) => {
                  const st = statusDaParcela(p, hoje)
                  const corrida = acumuladoPorId.get(p.id)
                  return (
                    <tr
                      key={p.id}
                      className={
                        st === 'paga' ? 'cro-quitada' : p.balao ? 'cro-balao' : undefined
                      }
                    >
                      <td>{p.numero_parcela}</td>
                      <td>{p.data_prevista ? formatarData(p.data_prevista) : '—'}</td>
                      <td>{p.data_prevista ? diaPorExtenso(p.data_prevista) : '—'}</td>
                      <td className="dir">{formatarMoeda(p.valor_previsto)}</td>
                      <td className="dir">{formatarMoeda(corrida?.acumulado ?? 0)}</td>
                      <td className="dir">{formatarMoeda(corrida?.saldo ?? 0)}</td>
                      <td className="cen">{st === 'paga' ? 'X' : ''}</td>
                      <td>{p.forma_pagamento ?? ''}</td>
                      <td className="cen forte">{rotuloStatus(st)}</td>
                    </tr>
                  )
                })}
              </Fragment>
            ))}
            <tr className="cro-total">
              <td colSpan={3}>TOTAL GERAL</td>
              <td className="dir">{formatarMoeda(resumo.total_previsto)}</td>
              <td colSpan={5}></td>
            </tr>
          </tbody>
        </table>

        <div className="cro-notas">
          <div className="cro-nota-titulo">COMO ACOMPANHAR:</div>
          <ul>
            <li>
              Cada parcela quitada aparece marcada com &quot;X&quot; e em verde — o total pago, o
              saldo e o percentual acima acompanham automaticamente.
            </li>
            <li>
              A forma de pagamento é registrada parcela por parcela (Pix ou espécie), com o
              comprovante anexado ao final deste documento.
            </li>
          </ul>

          <div className="cro-nota-titulo">OBSERVAÇÕES:</div>
          <ol>
            {observacoes.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ol>
        </div>

        <div className="cro-assinatura">
          <div className="cro-linha-assinatura" />
          <div className="forte">{empresa.responsavel}</div>
          <div>
            {empresa.nome} — Responsável Técnico
            {empresa.crea ? ` — ${empresa.crea}` : ''}
          </div>
        </div>
      </div>

      {comComprovante.map((p) => (
        <div key={p.id} className="quebra-pagina">
          <div className="cro">
            <div className="cro-faixa-anexo">
              <div className="cro-marca-anexo">{empresa.nome.toUpperCase()}</div>
              <div className="cro-anexo-texto">
                <div className="cro-anexo-titulo">COMPROVANTE DE PAGAMENTO</div>
                <div>
                  Obra: {obra.nome} | Cliente: {cliente?.nome ?? '—'}
                </div>
              </div>
            </div>

            <div className="cro-tarja">
              <span>
                <b>Parcela</b> {p.numero_parcela}/{quantidade}
              </span>
              <span>
                <b>Data</b> {p.data_recebimento ? formatarData(p.data_recebimento) : '—'}
              </span>
              <span>
                <b>Valor</b> {formatarMoeda(valorEfetivo(p))}
              </span>
              <span>
                <b>Forma</b> {p.forma_pagamento ?? '—'}
              </span>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.comprovante_assinado!}
              alt={`Comprovante da parcela ${p.numero_parcela}`}
              className="cro-comprovante"
            />

            <footer className="cro-rodape-anexo">
              {empresa.nome} — Engenharia e Construções
            </footer>
          </div>
        </div>
      ))}
    </>
  )
}

// -----------------------------------------------------------------------------

function FaixaDaMarca({ empresa }: { empresa: DadosEmpresa }) {
  return (
    <div className="cro-faixa-marca">
      {empresa.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={empresa.logo_url} alt={empresa.nome} className="cro-logo" />
      ) : (
        <div className="cro-logo-texto">{empresa.nome.toUpperCase()}</div>
      )}
    </div>
  )
}

function Cartao({
  rotulo,
  valor,
  tom,
}: {
  rotulo: string
  valor: string
  tom?: 'verde'
}) {
  return (
    <div className={`cro-cartao${tom === 'verde' ? ' cro-cartao-verde' : ''}`}>
      <div className="cro-cartao-rotulo">{rotulo}</div>
      <div className="cro-cartao-valor">{valor}</div>
    </div>
  )
}

// -----------------------------------------------------------------------------

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const

/** "sábado", minúsculo e por extenso, como no padrão. */
function diaPorExtenso(iso: DataISO): string {
  return DIAS[diaDaSemana(iso)] ?? ''
}

function rotuloStatus(status: 'paga' | 'atrasada' | 'prevista'): string {
  if (status === 'paga') return 'QUITADO'
  if (status === 'atrasada') return 'EM ATRASO'
  return 'A VENCER'
}

function regimeLegivel(forma: string): string {
  if (forma === 'empreitada') return 'Empreitada de mão de obra'
  if (forma === 'diaria') return 'Diária'
  if (forma === 'misto') return 'Misto'
  return forma
}

/**
 * As observacoes numeradas do pe do documento. Sao geradas do que esta no
 * banco, nunca fixas: parcela que foi paga fora do vencimento tem a data real
 * dita aqui, porque a coluna de vencimento guarda a data prevista (padrao 3.1.8).
 */
function observacoesDoCronograma(
  parcelas: ParcelaComComprovante[],
  valorContrato: number,
  hoje: DataISO,
): string[] {
  const notas: string[] = [
    `Cronograma referente ao valor total de ${formatarMoeda(valorContrato)} da obra, ` +
      'conforme a planilha orçamentária.',
  ]

  const pagas = parcelas
    .filter((p) => statusDaParcela(p, hoje) === 'paga' && p.data_recebimento)
    .sort((a, b) => a.numero_parcela - b.numero_parcela)

  if (pagas.length > 0) {
    const lista = pagas
      .map((p) => {
        const fora =
          p.data_prevista && p.data_recebimento && p.data_prevista !== p.data_recebimento
            ? ` (venc. ${formatarData(p.data_prevista)})`
            : ''
        return `${p.numero_parcela}ª em ${formatarData(p.data_recebimento!)}${fora}`
      })
      .join(', ')
    const formas = [...new Set(pagas.map((p) => p.forma_pagamento).filter(Boolean))]
    const via = formas.length === 1 ? `, todas via ${formas[0]}` : ''
    notas.push(`Parcelas quitadas: ${lista}${via}.`)
  }

  const balao = parcelas.find((p) => p.balao)
  if (balao?.data_prevista) {
    notas.push(
      `O saldo remanescente é quitado na ${balao.numero_parcela}ª parcela, em pagamento ` +
        `único (balão), em ${formatarData(balao.data_prevista)}, encerrando o cronograma.`,
    )
  }

  notas.push(
    'A forma de pagamento é registrada individualmente em cada parcela (Pix ou espécie), ' +
      'mediante recibo ou comprovante.',
  )
  notas.push(
    'Datas sujeitas a ajuste por comum acordo entre as partes; medições e eventuais ' +
      'reajustes conforme o avanço físico da obra.',
  )

  for (const p of parcelas) {
    if (p.valor_outro_contrato > 0) {
      notas.push(
        `Parcela ${p.numero_parcela}: do valor recebido, ` +
          `${formatarMoeda(p.valor_outro_contrato)} referem-se a outro contrato e não foram ` +
          'considerados nesta obra.',
      )
    }
    if (p.observacao) notas.push(`Parcela ${p.numero_parcela}: ${p.observacao}`)
  }

  return notas
}

// -----------------------------------------------------------------------------
// Medidas e cores do padrao (relatorios-de-cliente.md, secao 1).
// -----------------------------------------------------------------------------

const CSS = `
@page { size: A4 portrait; margin: 0.45in 0.35in; }

.cro {
  width: 520pt;
  margin: 0 auto;
  padding: 10pt;
  background: #fff;
  color: #262626;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 9pt;
  line-height: 1.3;
}
@media print { .cro { width: auto; padding: 0; } }

/* 1. Faixa navy com a marca centralizada */
.cro-faixa-marca {
  height: 60pt;
  background: #1F3864;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cro-logo { height: 42pt; width: auto; object-fit: contain; }
.cro-logo-texto { color: #fff; font-size: 16pt; font-weight: 700; letter-spacing: .06em; }

/* 2. Barra azul com o nome do documento */
.cro-barra-titulo {
  background: #2E5395;
  color: #fff;
  font-size: 12pt;
  font-weight: 700;
  text-align: center;
  padding: 6pt 8pt;
}

/* 3. Bloco de dados */
.cro-dados { width: 100%; border-collapse: collapse; margin-top: 8pt; }
.cro-dados th, .cro-dados td {
  border: .5pt solid #BFBFBF;
  padding: 2pt 5pt;
  font-size: 9pt;
  text-align: left;
  white-space: nowrap;      /* "RESPONSÁVEL:" nunca quebra no meio */
}
.cro-dados th { background: #F2F2F2; font-weight: 700; width: 78pt; }
.cro-dados td { white-space: normal; }

/* 4. Painel de indicadores */
.cro-painel { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6pt; margin-top: 8pt; }
.cro-cartao { border: .5pt solid #BFBFBF; background: #F2F2F2; padding: 4pt 6pt; text-align: center; }
.cro-cartao-verde { background: #E2EFDA; }
.cro-cartao-verde .cro-cartao-valor { color: #375623; }
.cro-cartao-rotulo { color: #1F3864; font-size: 7pt; font-weight: 700; letter-spacing: .03em; }
.cro-cartao-valor { font-size: 12pt; font-weight: 700; margin-top: 2pt; }

/* 5. Tabela principal */
.cro-tabela { width: 100%; border-collapse: collapse; margin-top: 10pt; font-size: 8pt; }
.cro-tabela th, .cro-tabela td { border: .5pt solid #BFBFBF; padding: 2pt 4pt; text-align: left; }
.cro-tabela thead th {
  background: #1F3864;
  color: #fff;
  font-size: 7.5pt;
  font-weight: 700;
  text-align: center;
}
.cro-tabela .dir { text-align: right; }
.cro-tabela .cen { text-align: center; }
.cro-tabela .forte { font-weight: 700; }
.cro-faixa-mes td {
  background: #E9EDF4;
  color: #1F3864;
  font-weight: 700;
  font-size: 8pt;
  letter-spacing: .04em;
}
.cro-quitada td { background: #E2EFDA; font-weight: 700; }
.cro-balao td { background: #DCE6F1; font-weight: 700; }
.cro-total td { background: #1F3864; color: #fff; font-weight: 700; }

/* 6. Notas */
.cro-notas { margin-top: 8pt; font-size: 8pt; }
.cro-nota-titulo { font-weight: 700; color: #1F3864; margin-top: 6pt; }
.cro-notas ul, .cro-notas ol { margin: 3pt 0 0; padding-left: 16pt; }
.cro-notas li { font-style: italic; margin-bottom: 1pt; }

/* 7. Assinatura */
.cro-assinatura { margin-top: 16pt; text-align: center; font-size: 9pt; }
.cro-linha-assinatura { width: 200pt; margin: 0 auto 3pt; border-top: .8pt solid #262626; }
.forte { font-weight: 700; }

/* Anexo de comprovante */
.cro-faixa-anexo {
  background: #1F3864;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8pt 10pt;
}
.cro-marca-anexo { font-size: 13pt; font-weight: 700; letter-spacing: .05em; }
.cro-anexo-texto { text-align: right; font-size: 8pt; }
.cro-anexo-titulo { font-size: 11pt; font-weight: 700; }
.cro-tarja {
  background: #DCE6F1;
  display: flex;
  justify-content: space-between;
  gap: 8pt;
  padding: 5pt 10pt;
  font-size: 9pt;
  border: .5pt solid #BFBFBF;
  border-top: none;
}
.cro-comprovante {
  display: block;
  margin: 10pt auto 0;
  max-width: 100%;
  max-height: 560pt;
  object-fit: contain;
  border: .5pt solid #BFBFBF;
}
.cro-rodape-anexo {
  margin-top: 10pt;
  text-align: center;
  font-size: 8pt;
  color: #595959;
}
`
