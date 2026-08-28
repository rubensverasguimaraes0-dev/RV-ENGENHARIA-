'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/server'
import { exigirAdmin } from '@/lib/supabase/sessao'
import { moedaOuZero, numeroOuNulo, textoObrigatorio, textoOuNulo, type EstadoForm } from '@/lib/form'
import { carregarProjetoSolar } from '@/lib/dados/solar'

/**
 * Fluxo expresso (uma tela): a conta do cliente entra e a proposta sai pronta.
 *
 * Faz de uma vez o que o fluxo completo faz em quatro passos — cadastra o
 * cliente se ele ainda nao existe, cria o projeto, dimensiona, monta a cotacao
 * com a base de precos e congela os valores — e leva direto para a proposta.
 *
 * Congelar aqui e proposital: a proposta que o cliente recebe nao pode mudar
 * sozinha quando o fornecedor reajustar o preco na semana seguinte.
 */
export async function gerarPropostaExpressa(
  _e: EstadoForm | null,
  form: FormData,
): Promise<EstadoForm> {
  await exigirAdmin()
  const supabase = await criarClienteServidor()

  const consumo = numeroOuNulo(form.get('consumo_medio'))
  const tarifa = moedaOuZero(form.get('tarifa'))

  if (consumo === null || consumo <= 0) return { erro: 'Informe o consumo médio da conta, em kWh.' }
  if (tarifa <= 0) return { erro: 'Informe a tarifa da conta, em R$ por kWh.' }

  // Cliente: usa o existente, ou cadastra na hora com o que foi digitado.
  let cliente_id = textoOuNulo(form.get('cliente_id'))
  if (!cliente_id) {
    const nome = textoObrigatorio(form.get('cliente_nome'))
    if (!nome) return { erro: 'Escolha um cliente da lista, ou digite o nome de um novo.' }

    const { data, error } = await supabase
      .from('clientes')
      .insert({
        nome,
        telefone: textoOuNulo(form.get('cliente_telefone')),
        documento: textoOuNulo(form.get('cliente_documento')),
      })
      .select('id')
      .single()

    if (error) return { erro: `Não consegui cadastrar o cliente: ${error.message}` }
    cliente_id = data.id as string
  }

  const { data: projeto, error } = await supabase
    .from('projetos_solar')
    .insert({
      cliente_id,
      uc: textoOuNulo(form.get('uc')),
      concessionaria: textoOuNulo(form.get('concessionaria')),
      tipo_ligacao: textoObrigatorio(form.get('tipo_ligacao')) || 'monofasica',
      tarifa,
      consumo_mensal_json: [consumo],
      tipo_telhado: textoOuNulo(form.get('tipo_telhado')),
      distancia_quadro: numeroOuNulo(form.get('distancia_quadro')) ?? 20,
      anexo_conta_url: textoOuNulo(form.get('anexo')),
      status: 'cotado',
    })
    .select('id')
    .single()

  if (error) return { erro: error.message }
  const projetoId = projeto.id as string

  // Dimensiona e cota com a base de precos, e grava o resultado no projeto.
  const dados = await carregarProjetoSolar(projetoId)
  if (!dados) return { erro: 'Projeto criado, mas não consegui montar a cotação.' }

  if (dados.dimensionamento.aviso) {
    // Consumo abaixo do custo de disponibilidade: nao ha proposta a fazer.
    await supabase
      .from('projetos_solar')
      .update({ status: 'rascunho' })
      .eq('id', projetoId)
    return { erro: dados.dimensionamento.aviso }
  }

  await supabase
    .from('projetos_solar')
    .update({
      potencia_kwp: dados.dimensionamento.potencia_instalada_kwp,
      qtd_modulos: dados.dimensionamento.qtd_modulos,
      geracao_estimada: dados.dimensionamento.geracao_mensal_estimada,
      modelo_modulo: dados.cotacao.itens.find((i) => i.categoria === 'modulo')?.descricao ?? null,
      modelo_inversor: dados.cotacao.itens.find((i) => i.categoria === 'inversor')?.descricao ?? null,
      custo_total: dados.cotacao.custo_total,
      preco_venda: dados.cotacao.preco_venda,
      margem: dados.parametros.margem,
    })
    .eq('id', projetoId)

  await supabase.from('itens_projeto_solar').delete().eq('projeto_id', projetoId)
  await supabase.from('itens_projeto_solar').insert(
    dados.cotacao.itens.map((item, ordem) => ({
      projeto_id: projetoId,
      descricao: item.descricao,
      quantidade: item.quantidade,
      preco_unitario: item.custo_unitario,
      total: item.custo_total,
      ordem,
    })),
  )

  revalidatePath('/solar')
  redirect(`/solar/${projetoId}/proposta?nova=1`)
}
