import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { carregarMaoDeObra } from '@/lib/dados/mao-de-obra'
import { carregarParametros, dadosEmpresa } from '@/lib/parametros'
import { BarraImpressao } from '@/components/documento'
import { BotaoImprimir } from '@/components/botao-imprimir'
import { formatarData, formatarMoeda } from '@/lib/format'
import type { DiaDeMaoDeObra } from '@/lib/domain/mao-de-obra'

/**
 * Relatorio interno de mao de obra — custo realizado, no formato de
 * Relatorio_Mao_de_Obra_Piso_Industrial_REVEST.pdf.
 *
 * DOCUMENTO INTERNO. Mostra quanto cada pessoa custou e como o saldo da verba
 * e dividido entre os executores. Nunca vai ao cliente (spec 11.1) — por isso
 * o carimbo vermelho no topo e no pe.
 */
export default async function RelatorioMaoDeObra({
  params,
}: {
  params: Promise<{ obraId: string }>
}) {
  const { obraId } = await params
  await exigirAdmin()

  const [obra, parametros] = await Promise.all([carregarObra(obraId), carregarParametros()])
  if (!obra) notFound()

  const empresa = dadosEmpresa(parametros)
  const r = await carregarMaoDeObra(obraId, obra.verba_mao_obra)
  const cliente = obra.pagador ?? obra.cliente
  const periodo =
    r.dias.length > 0
      ? `${formatarData(r.dias[0]!.data)} a ${formatarData(r.dias[r.dias.length - 1]!.data)}`
      : '—'

  return (
    <>
      <BarraImpressao>
        <Link href={`/obras/${obraId}`} className="botao botao-neutro">
          Voltar
        </Link>
        <BotaoImprimir />
      </BarraImpressao>

      <style>{CSS}</style>

      <div className="mo">
        <div className="mo-carimbo">
          {empresa.nome} — Documento interno de controle de custos · Emitido em{' '}
          {formatarData(hojeISO())}
        </div>

        <header className="mo-topo">
          <div className="mo-marca">{empresa.nome.toUpperCase()}</div>
          <div className="mo-contato">
            {empresa.responsavel_titulo} {empresa.responsavel} — {empresa.crea}
            <br />
            {empresa.telefone} | {empresa.email}
            <br />
            {empresa.endereco} | {empresa.instagram}
          </div>
        </header>

        <h1 className="mo-titulo">RELATÓRIO DE MÃO DE OBRA — CUSTO REALIZADO</h1>
        <div className="mo-subtitulo">
          {obra.nome}
          {r.dias.length > 0 ? `  •  Execução: ${periodo}` : ''}
        </div>

        <table className="mo-dados">
          <tbody>
            <tr>
              <th>CLIENTE</th>
              <td>{cliente?.nome ?? '—'}</td>
              <th>OBRA</th>
              <td>{obra.endereco ?? obra.nome}</td>
            </tr>
            <tr>
              <th>RESPONSÁVEL</th>
              <td>{empresa.responsavel}</td>
              <th>EMISSÃO</th>
              <td>{formatarData(hojeISO())}</td>
            </tr>
          </tbody>
        </table>

        {r.dias.map((dia, i) => (
          <BlocoDoDia key={dia.data} dia={dia} numero={i + 1} />
        ))}

        <div className="mo-secao">{r.dias.length + 1}. RESUMO FINANCEIRO</div>
        <table className="mo-tabela">
          <tbody>
            {r.dias.map((dia) => (
              <tr key={dia.data}>
                <td>
                  {dia.nome_dia} — {formatarData(dia.data)}
                </td>
                <td className="dir">{formatarMoeda(dia.total_dia)}</td>
              </tr>
            ))}
            <tr className="mo-destaque">
              <td>TOTAL PAGO EM MÃO DE OBRA</td>
              <td className="dir">{formatarMoeda(r.total_pago)}</td>
            </tr>
            {r.verba > 0 && (
              <>
                <tr>
                  <td>Verba prevista de mão de obra (orçamento)</td>
                  <td className="dir">{formatarMoeda(r.verba)}</td>
                </tr>
                <tr className="mo-total">
                  <td>SALDO REMANESCENTE</td>
                  <td className="dir">{formatarMoeda(r.saldo)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        <div className="mo-secao">{r.dias.length + 2}. RESUMO POR PESSOA</div>
        <table className="mo-tabela">
          <thead>
            <tr>
              <th>PESSOA</th>
              <th className="dir">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {r.por_pessoa.map((p) => (
              <tr key={p.funcionario_id}>
                <td>{p.nome}</td>
                <td className="dir">{formatarMoeda(p.total)}</td>
              </tr>
            ))}
            <tr>
              <td>ALIMENTAÇÃO</td>
              <td className="dir">{formatarMoeda(r.total_alimentacao)}</td>
            </tr>
            <tr className="mo-destaque">
              <td>SUBTOTAL PAGO</td>
              <td className="dir">{formatarMoeda(r.total_pago)}</td>
            </tr>
            {r.executores.map((e) => (
              <tr key={e.funcionario_id}>
                <td>{e.nome}</td>
                <td className="dir">{formatarMoeda(e.total)}</td>
              </tr>
            ))}
            <tr className="mo-total">
              <td>TOTAL GERAL</td>
              <td className="dir">{formatarMoeda(r.total_geral)}</td>
            </tr>
          </tbody>
        </table>

        <p className="mo-observacao">
          <b>Observações:</b> valores referentes exclusivamente à mão de obra.{' '}
          {r.executores.length > 0 && r.saldo > 0 && (
            <>
              {r.executores.map((e) => e.nome).join(' e ')} não receberam diária — participaram da
              execução e dividem o saldo remanescente de {formatarMoeda(r.saldo)} (
              {formatarMoeda(r.parte_de_cada_executor)} para cada).{' '}
            </>
          )}
          Materiais, locação de equipamentos e descarte de entulho são apurados em relatório
          complementar.
        </p>

        <div className="mo-carimbo mo-carimbo-pe">
          Documento interno — não enviar ao cliente
        </div>
      </div>
    </>
  )
}

// -----------------------------------------------------------------------------

function BlocoDoDia({ dia, numero }: { dia: DiaDeMaoDeObra; numero: number }) {
  return (
    <>
      <div className="mo-secao">
        {numero}. {dia.nome_dia.toUpperCase()} — {formatarData(dia.data)}
      </div>
      <table className="mo-tabela">
        <thead>
          <tr>
            <th>PROFISSIONAL</th>
            <th>FUNÇÃO</th>
            <th className="cen">DIÁRIA</th>
            <th className="dir">VALOR</th>
          </tr>
        </thead>
        <tbody>
          {dia.pessoas.map((p) => (
            <tr key={p.funcionario_id}>
              <td>{p.nome}</td>
              <td>{p.funcao}</td>
              <td className="cen">{p.executor ? '—' : formatarDiarias(p.diarias)}</td>
              <td className="dir">{p.executor ? '—' : formatarMoeda(p.valor)}</td>
            </tr>
          ))}
          <tr>
            <td>ALIMENTAÇÃO</td>
            <td>
              {dia.qtd_quentinhas} quentinha{dia.qtd_quentinhas === 1 ? '' : 's'} ×{' '}
              {formatarMoeda(dia.valor_quentinha)}
            </td>
            <td className="cen">—</td>
            <td className="dir">{formatarMoeda(dia.custo_alimentacao)}</td>
          </tr>
          <tr className="mo-total">
            <td colSpan={3}>TOTAL DO DIA</td>
            <td className="dir">{formatarMoeda(dia.total_dia)}</td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

function formatarDiarias(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}

function hojeISO(): string {
  const agora = new Date()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${agora.getFullYear()}-${mes}-${dia}`
}

// -----------------------------------------------------------------------------

const CSS = `
@page { size: A4 portrait; margin: 15mm 17mm 20mm; }

.mo {
  width: 520pt;
  margin: 0 auto;
  padding: 10pt;
  background: #fff;
  color: #262626;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 9pt;
  line-height: 1.3;
}
@media print { .mo { width: auto; padding: 0; } }

/* Carimbo de documento interno — o padrao proibe custo e margem em documento
   de cliente, entao a marcacao tem de saltar aos olhos. */
.mo-carimbo {
  border: 1pt solid #7F1D1D;
  background: #FBE4E4;
  color: #7F1D1D;
  font-size: 8pt;
  font-weight: 700;
  text-align: center;
  padding: 3pt;
}
.mo-carimbo-pe { margin-top: 14pt; }

.mo-topo {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  border-bottom: 1.2pt solid #1F3864;
  padding: 8pt 0 5pt;
  margin-bottom: 10pt;
}
.mo-marca { color: #1F3864; font-size: 15pt; font-weight: 700; letter-spacing: .04em; }
.mo-contato { text-align: right; font-size: 7.5pt; color: #595959; line-height: 1.35; }

.mo-titulo {
  margin: 0;
  background: #1F3864;
  color: #fff;
  font-size: 11pt;
  font-weight: 700;
  text-align: center;
  padding: 5pt;
}
.mo-subtitulo { text-align: center; font-size: 8.5pt; color: #404040; margin: 3pt 0 8pt; }

.mo-dados { width: 100%; border-collapse: collapse; margin-bottom: 10pt; }
.mo-dados th, .mo-dados td { border: .5pt solid #BFBFBF; padding: 3pt 5pt; text-align: left; font-size: 8.5pt; }
.mo-dados th { background: #F2F2F2; color: #1F3864; font-weight: 700; width: 68pt; white-space: nowrap; }

.mo-secao {
  background: #1F3864;
  color: #fff;
  font-size: 9pt;
  font-weight: 700;
  padding: 3pt 6pt;
  margin-top: 10pt;
}
.mo-tabela { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
.mo-tabela th, .mo-tabela td { border: .5pt solid #BFBFBF; padding: 2.5pt 5pt; text-align: left; }
.mo-tabela thead th { background: #DCE6F1; color: #1F3864; font-size: 7.5pt; font-weight: 700; }
.mo-tabela .dir { text-align: right; }
.mo-tabela .cen { text-align: center; }
.mo-destaque td { background: #F2F2F2; font-weight: 700; }
.mo-total td { background: #E2EFDA; font-weight: 700; }

.mo-observacao { margin-top: 10pt; font-size: 8pt; color: #404040; text-align: justify; }
`
