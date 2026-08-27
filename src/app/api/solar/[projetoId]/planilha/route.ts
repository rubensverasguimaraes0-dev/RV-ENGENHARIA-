import { NextResponse } from 'next/server'
import { usuarioAtual } from '@/lib/supabase/sessao'
import { carregarProjetoSolar } from '@/lib/dados/solar'
import { carregarParametros, dadosEmpresa } from '@/lib/parametros'
import { calcularEconomia, projetar25Anos } from '@/lib/domain/solar'
import { gerarPlanilhaSolar } from '@/lib/docs/planilha-solar'
import { nomeDeArquivo } from '@/lib/docs/estilo-planilha'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projetoId: string }> },
) {
  const usuario = await usuarioAtual()
  if (!usuario) return new NextResponse('Não autenticado', { status: 401 })
  if (usuario.perfil !== 'admin') return new NextResponse('Sem permissão', { status: 403 })

  const { projetoId } = await params
  const [dados, parametros] = await Promise.all([
    carregarProjetoSolar(projetoId),
    carregarParametros(),
  ])
  if (!dados) return new NextResponse('Projeto não encontrado', { status: 404 })

  const { projeto, dimensionamento, cotacao, percentual_fio_b, tarifa_fio_b } = dados
  const investimento = projeto.preco_venda ?? cotacao.preco_venda

  const entradaEconomia = {
    dimensionamento,
    tarifa: projeto.tarifa,
    tarifa_fio_b,
    percentual_fio_b,
    investimento_total: investimento,
  }

  // A aba de apuracao interna so entra quando pedida explicitamente.
  const incluirApuracao = new URL(req.url).searchParams.get('interna') === '1'

  const buffer = await gerarPlanilhaSolar({
    projeto,
    dimensionamento,
    cotacao,
    economia: calcularEconomia(entradaEconomia),
    projecao: projetar25Anos(entradaEconomia),
    investimento,
    empresa: dadosEmpresa(parametros),
    incluirApuracao,
  })

  const nome = nomeDeArquivo(`proposta-solar-${projeto.cliente_nome}`)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nome}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
