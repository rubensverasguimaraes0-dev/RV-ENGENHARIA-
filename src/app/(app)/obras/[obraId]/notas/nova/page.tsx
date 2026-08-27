import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirUsuario } from '@/lib/supabase/sessao'
import { criarClienteServidor } from '@/lib/supabase/server'
import { listarObrasVisiveis } from '@/lib/dados/obra'
import { TituloPagina, Cartao } from '@/components/ui'
import { FormularioNota } from './formulario'

export default async function PaginaNovaNota({
  params,
}: {
  params: Promise<{ obraId: string }>
}) {
  const { obraId } = await params
  const usuario = await exigirUsuario()

  const obras = await listarObrasVisiveis()
  const obra = obras.find((o) => o.id === obraId)
  if (!obra) notFound()

  const supabase = await criarClienteServidor()
  const [{ data: fornecedoresData }, { data: locaisData }] = await Promise.all([
    usuario.perfil === 'admin'
      ? supabase.from('fornecedores').select('id, nome').is('excluido_em', null).order('nome')
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    supabase.from('locais_visiveis').select('id, nome').eq('obra_id', obraId).order('nome'),
  ])

  return (
    <>
      <TituloPagina
        titulo="Nova nota"
        subtitulo={`${obra.nome} · ${obra.cliente_nome}`}
        acoes={
          <Link href={`/obras/${obraId}/notas`} className="botao botao-neutro">
            Ver notas
          </Link>
        }
      />
      <div className="max-w-2xl">
        <Cartao titulo="Lançamento no balcão da loja">
          <FormularioNota
            obraId={obraId}
            fornecedores={(fornecedoresData ?? []) as { id: string; nome: string }[]}
            locais={(locaisData ?? []) as { id: string; nome: string }[]}
            ehAdmin={usuario.perfil === 'admin'}
          />
        </Cartao>
      </div>
    </>
  )
}
