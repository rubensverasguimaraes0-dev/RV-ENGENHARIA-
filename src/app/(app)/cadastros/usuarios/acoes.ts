'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteAdministrativo, criarClienteServidor } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { textoObrigatorio, type EstadoForm } from '@/lib/form'

export async function criarUsuario(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()

  const nome = textoObrigatorio(form.get('nome'))
  const email = textoObrigatorio(form.get('email')).toLowerCase()
  const senha = String(form.get('senha') ?? '')
  const perfil = textoObrigatorio(form.get('perfil')) || 'lancador'

  if (!nome || !email) return { erro: 'Informe nome e e-mail.' }
  if (senha.length < 8) return { erro: 'A senha precisa de pelo menos 8 caracteres.' }

  let admin
  try {
    admin = criarClienteAdministrativo()
  } catch {
    return {
      erro:
        'SUPABASE_SERVICE_ROLE_KEY não configurada. Sem ela o app não consegue criar usuários — ' +
        'crie o usuário pelo painel do Supabase.',
    }
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome, perfil },
  })

  if (error) return { erro: error.message }
  if (!data.user) return { erro: 'Usuário não criado.' }

  // A trigger do Auth cria a linha em public.usuarios; garante perfil e nome.
  const { error: erroPerfil } = await admin
    .from('usuarios')
    .upsert({ id: data.user.id, nome, email, perfil })
  if (erroPerfil) return { erro: erroPerfil.message }

  revalidatePath('/cadastros/usuarios')
  return { ok: `${nome} cadastrado como ${perfil === 'admin' ? 'administrador' : 'lançador'}.` }
}

export async function vincularObra(_e: EstadoForm | null, form: FormData): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const usuario_id = textoObrigatorio(form.get('usuario_id'))
  const obra_id = textoObrigatorio(form.get('obra_id'))
  if (!usuario_id || !obra_id) return { erro: 'Selecione o usuário e a obra.' }

  const { error } = await supabase
    .from('usuarios_obras')
    .upsert({ usuario_id, obra_id }, { onConflict: 'usuario_id,obra_id' })
  if (error) return { erro: error.message }

  revalidatePath('/cadastros/usuarios')
  return { ok: 'Vínculo criado.' }
}

export async function desvincularObra(form: FormData) {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  await supabase
    .from('usuarios_obras')
    .delete()
    .eq('usuario_id', textoObrigatorio(form.get('usuario_id')))
    .eq('obra_id', textoObrigatorio(form.get('obra_id')))
  revalidatePath('/cadastros/usuarios')
}
