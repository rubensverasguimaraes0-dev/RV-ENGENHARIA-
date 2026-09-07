import { NextResponse } from 'next/server'
import { usuarioAtual } from '@/lib/supabase/sessao'
import { carregarObra } from '@/lib/dados/obra'
import { carregarAcumuladoDaObra, carregarFechamento } from '@/lib/dados/semana'
import { carregarParametros, dadosEmpresa } from '@/lib/parametros'
import { gerarPlanilhaSemanal } from '@/lib/docs/planilha-semanal'
import { nomeDeArquivo } from '@/lib/docs/estilo-planilha'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ obraId: string; semanaId: string }> },
) {
  const usuario = await usuarioAtual()
  if (!usuario) return new NextResponse('Não autenticado', { status: 401 })
  // Planilha traz custo de mao de obra: so o administrador gera.
  if (usuario.perfil !== 'admin') return new NextResponse('Sem permissão', { status: 403 })

  const { obraId, semanaId } = await params
  const [obra, fechamento, parametros, acumulado] = await Promise.all([
    carregarObra(obraId),
    carregarFechamento(obraId, semanaId),
    carregarParametros(),
    carregarAcumuladoDaObra(obraId),
  ])

  if (!obra || !fechamento) return new NextResponse('Semana não encontrada', { status: 404 })

  const buffer = await gerarPlanilhaSemanal({
    fechamento,
    empresa: dadosEmpresa(parametros),
    obraNome: obra.nome,
    clienteNome: (obra.pagador ?? obra.cliente)?.nome ?? '',
    acumulado,
  })

  const arquivo = nomeDeArquivo(`semana-${fechamento.semana.numero}-${obra.nome}`)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${arquivo}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
