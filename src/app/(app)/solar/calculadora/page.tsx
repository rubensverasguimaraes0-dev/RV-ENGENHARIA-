import { exigirAdmin } from '@/lib/supabase/sessao'
import { carregarParametros, numero, centavos, texto } from '@/lib/parametros'
import Link from 'next/link'
import { TituloPagina } from '@/components/ui'
import { CalculadoraSolar } from './componente'
import type { ParametrosSolar } from '@/lib/domain/solar'

export default async function PaginaSolar() {
  await exigirAdmin()
  const p = await carregarParametros()

  const parametros: ParametrosSolar = {
    hsp: numero(p, 'solar_hsp', 5.4),
    performance_ratio: numero(p, 'solar_performance_ratio', 0.78),
    custo_disponibilidade: {
      monofasica: numero(p, 'solar_disp_monofasica', 30),
      bifasica: numero(p, 'solar_disp_bifasica', 50),
      trifasica: numero(p, 'solar_disp_trifasica', 100),
    },
    degradacao_anual: numero(p, 'solar_degradacao_anual', 0.0055),
    fator_inversor: numero(p, 'solar_fator_inversor', 0.8),
  }

  // percentual do Fio B do ano corrente, conforme a Lei 14.300
  const ano = String(new Date().getFullYear())
  let percentualFioB = 0.6
  try {
    const tabela = JSON.parse(texto(p, 'solar_percentual_fio_b', '{}')) as Record<string, number>
    percentualFioB = Number(tabela[ano] ?? percentualFioB)
  } catch {
    // mantém o padrão
  }

  return (
    <>
      <TituloPagina
        titulo="Calculadora de dimensionamento"
        subtitulo="Simulação rápida, sem salvar projeto"
        acoes={
          <Link href="/solar" className="botao botao-neutro">
            Projetos salvos
          </Link>
        }
      />
      <CalculadoraSolar
        parametros={parametros}
        percentualFioBAno={percentualFioB}
        tarifaFioB={centavos(p, 'solar_tarifa_fio_b', 30)}
      />
      <p className="mt-3 text-xs text-slate-600 max-w-3xl">
        Para montar a cotação com a base de preços e gerar a proposta ao cliente, crie um projeto
        em <Link href="/solar" className="acao acao-neutra">Projetos salvos</Link>.
      </p>
    </>
  )
}
