import { NextResponse } from 'next/server'
import { usuarioAtual } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { carregarAlmoxarifado } from '@/lib/dados/almoxarifado'
import { carregarParametros, dadosEmpresa } from '@/lib/parametros'
import { gerarPlanilhaAlmoxarifado } from '@/lib/docs/planilha-almoxarifado'
import { nomeDeArquivo } from '@/lib/docs/estilo-planilha'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ obraId: string }> },
) {
  const usuario = await usuarioAtual()
  if (!usuario) return new NextResponse('Não autenticado', { status: 401 })
  if (usuario.perfil !== 'admin') return new NextResponse('Sem permissão', { status: 403 })

  const { obraId } = await params
  const [obra, parametros] = await Promise.all([carregarObra(obraId), carregarParametros()])
  if (!obra) return new NextResponse('Obra não encontrada', { status: 404 })

  const { resumo } = await carregarAlmoxarifado(obraId)

  const buffer = await gerarPlanilhaAlmoxarifado({
    resumo,
    empresa: dadosEmpresa(parametros),
    obraNome: obra.nome,
    clienteNome: (obra.pagador ?? obra.cliente)?.nome ?? '',
  })

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="almoxarifado-${nomeDeArquivo(obra.nome)}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
