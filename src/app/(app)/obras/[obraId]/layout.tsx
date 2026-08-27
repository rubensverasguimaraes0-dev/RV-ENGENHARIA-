import { exigirUsuario } from '@/lib/supabase/sessao'
import { NavegacaoObra } from '@/components/navegacao-obra'

export default async function LayoutObra({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ obraId: string }>
}) {
  const { obraId } = await params
  const usuario = await exigirUsuario()

  return (
    <>
      <NavegacaoObra obraId={obraId} perfil={usuario.perfil} />
      {children}
    </>
  )
}
