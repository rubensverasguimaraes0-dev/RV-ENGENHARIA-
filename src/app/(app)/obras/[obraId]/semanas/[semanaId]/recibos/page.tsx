import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { carregarFechamento } from '@/lib/dados/semana'
import { carregarParametros, dadosEmpresa } from '@/lib/parametros'
import { Documento, BlocoDados, BarraImpressao } from '@/components/documento'
import { BotaoImprimir } from '@/components/botao-imprimir'
import { formatarData, formatarMoeda } from '@/lib/format'

/**
 * Recibo individual por funcionario (spec 4.5), para enviar junto com o Pix.
 * Um recibo por pagina; apenas quem trabalhou na semana.
 */
export default async function RecibosDaSemana({
  params,
}: {
  params: Promise<{ obraId: string; semanaId: string }>
}) {
  const { obraId, semanaId } = await params
  await exigirAdmin()

  const [obra, f, parametros] = await Promise.all([
    carregarObra(obraId),
    carregarFechamento(obraId, semanaId),
    carregarParametros(),
  ])
  if (!obra || !f) notFound()

  const empresa = dadosEmpresa(parametros)
  const recebedores = f.funcionarios.filter((r) => r.total_diarias > 0)

  return (
    <>
      <BarraImpressao>
        <Link href={`/obras/${obraId}/semanas/${semanaId}`} className="botao botao-neutro">
          Voltar
        </Link>
        <BotaoImprimir rotulo={`Imprimir ${recebedores.length} recibo(s)`} />
      </BarraImpressao>

      {recebedores.length === 0 && (
        <div className="folha">
          <p className="text-sm text-slate-600">
            Nenhum funcionário com diária a receber nesta semana.
          </p>
        </div>
      )}

      {recebedores.map((r, i) => (
        <div key={r.funcionario_id} className={i > 0 ? 'quebra-pagina' : undefined}>
          <Documento
            empresa={empresa}
            titulo="Recibo de pagamento"
            subtitulo={`Semana ${f.semana.numero}`}
            geradoEm={new Date()}
            assinar={false}
            cabecalho={
              <BlocoDados
                itens={[
                  { rotulo: 'Recebedor', valor: <strong>{r.nome}</strong> },
                  { rotulo: 'Função', valor: r.funcao || '—' },
                  { rotulo: 'Obra', valor: obra.nome },
                  {
                    rotulo: 'Período',
                    valor: `${formatarData(f.semana.data_inicio)} a ${formatarData(f.semana.data_fim)}`,
                  },
                  { rotulo: 'Chave PIX', valor: r.chave_pix ?? '—' },
                  { rotulo: 'Data', valor: formatarData(f.semana.data_fim) },
                ]}
              />
            }
          >
            <table className="tabela">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th className="num">Quantidade</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Diárias cheias</td>
                  <td className="num">{r.dias_cheios}</td>
                  <td className="num"></td>
                </tr>
                {r.dias_meios > 0 && (
                  <tr>
                    <td>Meias diárias</td>
                    <td className="num">{r.dias_meios}</td>
                    <td className="num"></td>
                  </tr>
                )}
                {r.dias_sem_diaria > 0 && (
                  <tr>
                    <td>Dias sem diária</td>
                    <td className="num">{r.dias_sem_diaria}</td>
                    <td className="num">{formatarMoeda(0)}</td>
                  </tr>
                )}
                <tr className="subtotal">
                  <td colSpan={2}>Total de diárias</td>
                  <td className="num">{formatarMoeda(r.total_diarias)}</td>
                </tr>
                <tr>
                  <td colSpan={2}>Vales / adiantamentos descontados</td>
                  <td className="num">-{formatarMoeda(r.total_vales)}</td>
                </tr>
                <tr className="total">
                  <td colSpan={2}>Líquido a receber</td>
                  <td className="num">{formatarMoeda(r.liquido)}</td>
                </tr>
              </tbody>
            </table>

            <p className="mt-4 text-[11px] leading-relaxed">
              Recebi de {empresa.nome} a importância de{' '}
              <strong>{formatarMoeda(r.liquido)}</strong>, referente aos dias trabalhados no período
              acima, dando plena quitação pelo valor recebido.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-8 text-center text-[11px]">
              <div className="border-t border-slate-700 pt-1">
                {r.nome}
                <div className="text-[10px] text-slate-600">Recebedor</div>
              </div>
              <div className="border-t border-slate-700 pt-1">
                {empresa.responsavel}
                <div className="text-[10px] text-slate-600">
                  {empresa.responsavel_titulo} — {empresa.crea}
                </div>
              </div>
            </div>
          </Documento>
        </div>
      ))}
    </>
  )
}
