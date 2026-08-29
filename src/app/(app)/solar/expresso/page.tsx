import Link from 'next/link'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { criarClienteServidor } from '@/lib/supabase/server'
import { carregarBaseDePrecos } from '@/lib/dados/cotacoes'
import { carregarParametros, texto } from '@/lib/parametros'
import { TituloPagina, Cartao } from '@/components/ui'
import { FormularioExpresso } from './formulario'
import { leituraConfigurada } from '@/lib/ia/claude'

/**
 * Da conta do cliente a proposta pronta, numa tela so.
 * O fluxo completo (/solar/[id]) continua existindo para quem precisa ajustar
 * a cotacao item a item antes de enviar.
 */
export default async function PaginaSolarExpresso() {
  await exigirAdmin()

  const supabase = await criarClienteServidor()
  const [{ data: clientesData }, parametros, base] = await Promise.all([
    supabase.from('clientes').select('id, nome, telefone').is('excluido_em', null).order('nome'),
    carregarParametros(),
    carregarBaseDePrecos(),
  ])

  // Sem preço na base não há proposta a montar: melhor avisar antes de a pessoa
  // preencher tudo e receber uma proposta zerada.
  const categorias = new Set(base.grupos.map((g) => (g.escolhido.categoria ?? '').toLowerCase()))
  const faltando = ['modulo', 'inversor', 'estrutura', 'cabo', 'stringbox', 'eletrico'].filter(
    (c) => !categorias.has(c),
  )

  return (
    <>
      <TituloPagina
        titulo="Proposta expressa"
        subtitulo="A conta do cliente entra, a proposta sai pronta"
        acoes={
          <>
            <Link href="/solar" className="botao botao-neutro">
              Projetos
            </Link>
            <Link href="/solar/calculadora" className="botao botao-neutro">
              Calculadora
            </Link>
          </>
        }
      />

      {faltando.length > 0 && (
        <div className="mb-3 rounded border border-alerta-700/40 bg-alerta-100 px-3 py-2">
          <p className="text-sm font-bold text-alerta-700">
            A base de preços ainda não tem: {faltando.join(', ')}.
          </p>
          <p className="text-xs text-alerta-700 mt-1">
            A proposta sai, mas com esses itens zerados. Cadastre uma cotação de fornecedor para o
            valor final fechar.
          </p>
          <Link href="/cadastros/cotacoes" className="botao botao-neutro mt-2">
            Ir para a base de preços
          </Link>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <Cartao titulo="Conta do cliente">
          <FormularioExpresso
            clientes={(clientesData ?? []) as { id: string; nome: string; telefone: string | null }[]}
            concessionariaPadrao={texto(parametros, 'solar_concessionaria_padrao', 'Equatorial Piauí')}
            leituraDisponivel={leituraConfigurada()}
          />
        </Cartao>

        <Cartao titulo="O que acontece ao enviar">
          <ol className="text-sm text-slate-700 space-y-2 list-decimal pl-4">
            <li>O cliente é cadastrado, se ainda não existir.</li>
            <li>A conta fica guardada no cadastro dele.</li>
            <li>O sistema é dimensionado pelo consumo e pela ligação.</li>
            <li>A cotação é montada com o menor preço vigente da base.</li>
            <li>Os valores são congelados no projeto.</li>
            <li>A proposta abre pronta, com o botão de enviar por WhatsApp.</li>
          </ol>
          <p className="mt-3 text-[11px] text-slate-500">
            Congelar é de propósito: a proposta que o cliente recebeu não muda sozinha se o
            fornecedor reajustar o preço depois.
          </p>
        </Cartao>
      </div>
    </>
  )
}
