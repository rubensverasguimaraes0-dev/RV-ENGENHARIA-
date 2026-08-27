import { NextResponse } from 'next/server'
import { usuarioAtual } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { carregarOrcamento } from '@/lib/dados/orcamento'
import { carregarParametros, dadosEmpresa } from '@/lib/parametros'
import { gerarPlanilhaOrcamento } from '@/lib/docs/planilha-orcamento'
import { nomeDeArquivo } from '@/lib/docs/estilo-planilha'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ obraId: string; orcamentoId: string }> },
) {
  const usuario = await usuarioAtual()
  if (!usuario) return new NextResponse('Não autenticado', { status: 401 })
  // A planilha traz custo e margem: e a versao interna.
  if (usuario.perfil !== 'admin') return new NextResponse('Sem permissão', { status: 403 })

  const { obraId, orcamentoId } = await params
  const [obra, dados, parametros] = await Promise.all([
    carregarObra(obraId),
    carregarOrcamento(orcamentoId),
    carregarParametros(),
  ])

  if (!obra || !dados) return new NextResponse('Orçamento não encontrado', { status: 404 })

  const buffer = await gerarPlanilhaOrcamento({
    orcamento: dados.orcamento,
    calculo: dados.calculo,
    pendencias: dados.pendencias,
    empresa: dadosEmpresa(parametros),
    obraNome: obra.nome,
    clienteNome: (obra.pagador ?? obra.cliente)?.nome ?? '',
  })

  const nome = nomeDeArquivo(`orcamento-${dados.orcamento.titulo ?? obra.nome}`)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nome}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
