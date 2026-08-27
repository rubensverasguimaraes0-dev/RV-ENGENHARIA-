import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { carregarAlmoxarifado } from '@/lib/dados/almoxarifado'
import { carregarParametros, dadosEmpresa } from '@/lib/parametros'
import { Documento, BlocoDados, BarraImpressao } from '@/components/documento'
import { BotaoImprimir } from '@/components/botao-imprimir'
import { formatarData, formatarMoeda, formatarNumero, hojeISO } from '@/lib/format'

/**
 * Relatorio do almoxarifado para o cliente (spec 4.10): planilha enxuta, A4,
 * com a logo no topo. O custo unitario nao entra — so o valor de cobranca.
 */
export default async function RelatorioAlmoxarifado({
  params,
}: {
  params: Promise<{ obraId: string }>
}) {
  const { obraId } = await params
  await exigirAdmin()

  const [obra, parametros] = await Promise.all([carregarObra(obraId), carregarParametros()])
  if (!obra) notFound()

  const { resumo } = await carregarAlmoxarifado(obraId)
  const empresa = dadosEmpresa(parametros)
  const cliente = obra.pagador ?? obra.cliente

  return (
    <>
      <BarraImpressao>
        <Link href={`/obras/${obraId}/almoxarifado`} className="botao botao-neutro">
          Voltar
        </Link>
        <BotaoImprimir />
        <Link href={`/api/obras/${obraId}/almoxarifado/planilha`} className="botao botao-neutro">
          Planilha (xlsx)
        </Link>
      </BarraImpressao>

      <Documento
        empresa={empresa}
        titulo="Material em obra"
        subtitulo="Almoxarifado"
        geradoEm={new Date()}
        cabecalho={
          <BlocoDados
            itens={[
              { rotulo: 'Cliente', valor: cliente?.nome ?? '—' },
              { rotulo: 'Obra', valor: obra.nome },
              { rotulo: 'Local', valor: obra.endereco ?? '—' },
              { rotulo: 'Data', valor: formatarData(hojeISO()) },
            ]}
          />
        }
      >
        <table className="tabela">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Unidade</th>
              <th className="num">Quantidade</th>
              <th className="num">Saídas</th>
              <th className="num">Saldo</th>
              <th className="num">Valor cobrado</th>
            </tr>
          </thead>
          <tbody>
            {resumo.grupos.map((g) => (
              <Grupo key={g.categoria} grupo={g} />
            ))}
            <tr className="total">
              <td colSpan={5}>Total do material cobrado</td>
              <td className="num">{formatarMoeda(resumo.total_cobrado)}</td>
            </tr>
          </tbody>
        </table>

        {resumo.itens_sem_quantidade > 0 && (
          <p className="mt-2 text-[10px] text-slate-600">
            {resumo.itens_sem_quantidade} item(ns) ainda sem quantidade definida, a conferir na obra.
          </p>
        )}
      </Documento>
    </>
  )
}

function Grupo({ grupo }: { grupo: import('@/lib/domain/almoxarifado').GrupoCategoria }) {
  return (
    <>
      <tr className="secao">
        <td colSpan={6}>{grupo.categoria}</td>
      </tr>
      {grupo.itens.map((i) => (
        <tr key={i.id}>
          <td>
            {i.descricao}
            {i.cor_bitola && <span className="text-[10px] text-slate-600"> · {i.cor_bitola}</span>}
          </td>
          <td>{i.unidade ?? '—'}</td>
          <td className="num">
            {i.quantidade === null ? 'a contar' : formatarNumero(i.quantidade, i.quantidade % 1 === 0 ? 0 : 2)}
          </td>
          <td className="num">{i.total_saidas > 0 ? formatarNumero(i.total_saidas, i.total_saidas % 1 === 0 ? 0 : 2) : '—'}</td>
          <td className="num">{i.saldo === null ? '—' : formatarNumero(i.saldo, i.saldo % 1 === 0 ? 0 : 2)}</td>
          <td className="num">{i.valor_cobrado > 0 ? formatarMoeda(i.valor_cobrado) : '—'}</td>
        </tr>
      ))}
      {grupo.subgrupos.map((s) => (
        <tr key={s.cor_bitola} className="subtotal">
          <td colSpan={2}>Subtotal {s.cor_bitola} — {s.quantidade_pedacos} pedaço(s)</td>
          <td className="num">{formatarNumero(s.metragem_total)} m</td>
          <td className="num">{formatarNumero(s.metragem_total - s.metragem_restante)} m</td>
          <td className="num">{formatarNumero(s.metragem_restante)} m</td>
          <td className="num">{s.valor_cobrado > 0 ? formatarMoeda(s.valor_cobrado) : '—'}</td>
        </tr>
      ))}
    </>
  )
}
