import { supabaseConfigurado } from '@/lib/supabase/config'
import Link from 'next/link'

export const metadata = { title: 'Configurar — RV Engenharia' }

const PASSOS = [
  {
    titulo: '1. Crie o projeto no Supabase',
    texto:
      'Em supabase.com, crie um projeto na região mais próxima. Ele traz o banco Postgres, a autenticação e o armazenamento das fotos.',
  },
  {
    titulo: '2. Rode as migrations',
    texto:
      'No SQL Editor do projeto, execute na ordem os arquivos de supabase/migrations: 0001_schema.sql, 0002_rls.sql, 0003_seed.sql e 0004_storage.sql.',
  },
  {
    titulo: '3. Ligue a trigger de novos usuários',
    texto:
      'Ainda no SQL Editor: create trigger ao_criar_usuario after insert on auth.users for each row execute function public.ao_criar_usuario_auth();',
  },
  {
    titulo: '4. Preencha as variáveis de ambiente',
    texto:
      'Copie .env.example para .env.local (ou configure na Vercel) com NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY, disponíveis em Project Settings → API.',
  },
  {
    titulo: '5. Crie o primeiro administrador',
    texto:
      'Em Authentication → Users, crie o usuário do engenheiro. Depois, no SQL Editor: update public.usuarios set perfil = \'admin\' where email = \'seu@email.com\';',
  },
]

export default function PaginaConfigurar() {
  const pronto = supabaseConfigurado()

  return (
    <main className="min-h-screen p-4 flex items-start justify-center">
      <div className="w-full max-w-2xl mt-8">
        <div className="text-center mb-5">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-rv-800 text-white text-xl font-black">
            RV
          </div>
          <h1 className="mt-3 text-xl font-bold text-rv-900">RV Engenharia — Gestão</h1>
          <p className="text-sm text-slate-600">
            {pronto
              ? 'O Supabase já está configurado neste ambiente.'
              : 'Falta conectar o banco de dados para o app funcionar.'}
          </p>
        </div>

        {pronto ? (
          <div className="cartao p-4 text-center">
            <p className="text-sm text-ok-700 font-medium">Configuração encontrada.</p>
            <Link href="/login" className="botao botao-primario mt-3">
              Ir para o login
            </Link>
          </div>
        ) : (
          <div className="cartao overflow-hidden">
            <div className="cartao-titulo">Passo a passo</div>
            <ol className="divide-y divide-slate-200">
              {PASSOS.map((p) => (
                <li key={p.titulo} className="p-3">
                  <div className="font-semibold text-rv-900">{p.titulo}</div>
                  <p className="text-sm text-slate-700 mt-0.5">{p.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        <p className="mt-4 text-center text-xs text-slate-500">
          O passo a passo completo está no README do repositório.
        </p>
      </div>
    </main>
  )
}
