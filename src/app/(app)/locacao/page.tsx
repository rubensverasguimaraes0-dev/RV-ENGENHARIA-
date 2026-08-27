import { exigirAdmin } from '@/lib/supabase/sessao'
import { TituloPagina, Cartao } from '@/components/ui'

export default async function PaginaLocacao() {
  await exigirAdmin()

  return (
    <>
      <TituloPagina
        titulo="Locação de Equipamentos"
        subtitulo="Braço novo da empresa — construção prevista para a fase final"
      />
      <Cartao titulo="Ainda não construído">
        <p className="text-sm text-slate-700">
          O módulo de locação é o item 14 da ordem de construção da especificação, deliberadamente
          deixado por último para não atrasar o que resolve o dia a dia da obra.
        </p>
        <p className="mt-2 text-sm text-slate-700">
          O banco de dados já tem as tabelas prontas — equipamentos, tabela de preços por diária,
          semana e mês, contratos de locação, itens do contrato e devolução —, de modo que a
          construção das telas não exige mudança de estrutura.
        </p>
        <ul className="mt-2 text-sm text-slate-700 list-disc pl-5 space-y-1">
          <li>cadastro de equipamentos com patrimônio, estoque e situação</li>
          <li>importação por CSV da tabela de preços (cerca de 85 itens já levantados)</li>
          <li>contrato de locação, caução e devolução com cobrança de diárias adicionais</li>
          <li>alerta de locação vencida e de equipamento não devolvido</li>
          <li>equipamento próprio alocado a uma obra entra como custo interno, sem receita</li>
        </ul>
      </Cartao>
    </>
  )
}
