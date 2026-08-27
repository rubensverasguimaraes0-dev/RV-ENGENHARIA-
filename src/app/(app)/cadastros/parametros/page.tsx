import { exigirAdmin } from '@/lib/supabase/sessao'
import { criarClienteServidor } from '@/lib/supabase/server'
import { TituloPagina, Cartao } from '@/components/ui'
import { FormularioParametros } from './formulario'

const GRUPOS: { titulo: string; prefixos: string[]; descricao: string }[] = [
  {
    titulo: 'Empresa e responsável técnico',
    prefixos: ['empresa_', 'responsavel_'],
    descricao: 'Cabeçalho e rodapé de todo documento gerado',
  },
  {
    titulo: 'Obras civis',
    prefixos: [
      'valor_quentinha',
      'faixas_quentinha',
      'percentual_meia',
      'percentual_rateio',
      'base_rateio',
      'sabado_',
    ],
    descricao: 'Quentinha, meia diária e rateio com o parceiro',
  },
  {
    titulo: 'Orçamento',
    prefixos: ['margem_padrao', 'bdi_padrao', 'cotacao_'],
    descricao: 'Margem e BDI padrão',
  },
  { titulo: 'Energia solar', prefixos: ['solar_'], descricao: 'Dimensionamento e proposta' },
  { titulo: 'Textos padrão', prefixos: ['texto_'], descricao: 'Condições comerciais dos documentos' },
]

export default async function PaginaParametros() {
  await exigirAdmin()
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('parametros').select('chave, valor, descricao').order('chave')

  const todos = (data ?? []) as { chave: string; valor: string; descricao: string | null }[]
  const usados = new Set<string>()
  const grupos = GRUPOS.map((g) => {
    const itens = todos.filter((p) => g.prefixos.some((pre) => p.chave.startsWith(pre)))
    itens.forEach((i) => usados.add(i.chave))
    return { ...g, itens }
  })
  const outros = todos.filter((p) => !usados.has(p.chave))

  return (
    <>
      <TituloPagina
        titulo="Parâmetros"
        subtitulo="Todo valor de referência do app mora aqui — nada fica fixo no código"
      />
      <Cartao titulo="Valores de referência">
        <FormularioParametros
          grupos={[...grupos, { titulo: 'Outros', descricao: '', prefixos: [], itens: outros }].filter(
            (g) => g.itens.length > 0,
          )}
        />
      </Cartao>
    </>
  )
}
