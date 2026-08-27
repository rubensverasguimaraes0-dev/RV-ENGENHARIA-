import Link from 'next/link'
import { exigirUsuario } from '@/lib/supabase/sessao'
import { listarObrasVisiveis } from '@/lib/dados/obra'
import { TituloPagina, Cartao, Vazio, Etiqueta, BotaoLink } from '@/components/ui'
import { formatarData } from '@/lib/format'

const ROTULO_STATUS: Record<string, { texto: string; tom: 'ok' | 'alerta' | 'neutra' }> = {
  orcada: { texto: 'Orçada', tom: 'neutra' },
  em_andamento: { texto: 'Em andamento', tom: 'ok' },
  paralisada: { texto: 'Paralisada', tom: 'alerta' },
  concluida: { texto: 'Concluída', tom: 'neutra' },
}

const ROTULO_FORMA: Record<string, string> = {
  diaria: 'Por diária',
  empreitada: 'Empreitada global',
  medicao: 'Por medição',
  unidade: 'Por unidade replicada',
}

export default async function PaginaObras() {
  const usuario = await exigirUsuario()
  const obras = await listarObrasVisiveis()

  const emAndamento = obras.filter((o) => o.status === 'em_andamento')
  const outras = obras.filter((o) => o.status !== 'em_andamento')

  return (
    <>
      <TituloPagina
        titulo="Obras Civis"
        subtitulo={
          usuario.perfil === 'admin'
            ? 'Selecione a obra para abrir o painel'
            : 'Obras em que você lança presença, quentinha e nota'
        }
        acoes={
          usuario.perfil === 'admin' ? (
            <BotaoLink href="/cadastros/obras" variante="primario">
              Nova obra
            </BotaoLink>
          ) : null
        }
      />

      {obras.length === 0 ? (
        <Vazio>
          {usuario.perfil === 'admin'
            ? 'Nenhuma obra cadastrada. Comece pelo cadastro de cliente e depois crie a obra.'
            : 'Você ainda não está vinculado a nenhuma obra. Peça ao engenheiro para liberar o acesso.'}
        </Vazio>
      ) : (
        <div className="space-y-3">
          {[
            { titulo: 'Em andamento', lista: emAndamento },
            { titulo: 'Demais obras', lista: outras },
          ]
            .filter((g) => g.lista.length > 0)
            .map((g) => (
              <Cartao key={g.titulo} titulo={`${g.titulo} (${g.lista.length})`}>
                <ul className="divide-y divide-slate-200">
                  {g.lista.map((o) => {
                    const st = ROTULO_STATUS[o.status] ?? ROTULO_STATUS.em_andamento!
                    return (
                      <li key={o.id}>
                        <Link
                          href={`/obras/${o.id}`}
                          className="flex items-center justify-between gap-3 py-2.5 px-1 hover:bg-rv-50"
                        >
                          <span>
                            <span className="font-semibold text-rv-900">{o.nome}</span>
                            <span className="block text-xs text-slate-600">
                              {o.cliente_nome}
                              {o.endereco ? ` · ${o.endereco}` : ''}
                            </span>
                            <span className="block text-[11px] text-slate-500">
                              {ROTULO_FORMA[o.forma_contratacao] ?? o.forma_contratacao}
                              {o.data_inicio ? ` · início ${formatarData(o.data_inicio)}` : ''}
                            </span>
                          </span>
                          <Etiqueta tom={st.tom}>{st.texto}</Etiqueta>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </Cartao>
            ))}
        </div>
      )}
    </>
  )
}
