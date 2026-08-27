/**
 * Versoes do documento por publico (spec 4.14).
 *
 * Todo orcamento e todo relatorio tem um seletor de versao antes de gerar, e
 * cada opcao liga ou desliga um bloco. A combinacao usada fica salva no
 * documento gerado, para repetir depois.
 */
export interface VersaoExibicao {
  /** Desligado na maioria dos fechamentos. */
  mostrar_preco_unitario: boolean
  /** Ex.: locacao de equipamento sai sem a quantidade de diarias. */
  mostrar_quantidade_unidade: boolean
  /** So na versao interna. */
  mostrar_bdi_margem: boolean
  mostrar_prazo_execucao: boolean
  mostrar_cnpj_cliente: boolean
  mostrar_numero_documento: boolean
  /** Ex.: locacao + entulho num unico valor. */
  agrupar_valor_unico: boolean
  /** So descricao e quantidade, sem nenhum valor. */
  versao_pedreiro: boolean
  /** Texto explicando que material e locacao encarecem, sendo a mao de obra a menor parcela. */
  destacar_composicao_custo: boolean
}

export const VERSAO_PADRAO: VersaoExibicao = {
  mostrar_preco_unitario: false,
  mostrar_quantidade_unidade: true,
  mostrar_bdi_margem: false,
  mostrar_prazo_execucao: true,
  mostrar_cnpj_cliente: true,
  mostrar_numero_documento: true,
  agrupar_valor_unico: false,
  versao_pedreiro: false,
  destacar_composicao_custo: false,
}

export const ROTULOS_VERSAO: Record<keyof VersaoExibicao, { rotulo: string; dica: string }> = {
  mostrar_preco_unitario: {
    rotulo: 'Mostrar preço unitário',
    dica: 'Desligado na maioria dos fechamentos.',
  },
  mostrar_quantidade_unidade: {
    rotulo: 'Mostrar quantidade e unidade',
    dica: 'Ex.: locação de equipamento sai sem a quantidade de diárias.',
  },
  mostrar_bdi_margem: {
    rotulo: 'Mostrar BDI e margem',
    dica: 'Só na versão interna. Nunca em documento de cliente.',
  },
  mostrar_prazo_execucao: {
    rotulo: 'Mostrar prazo de execução',
    dica: 'Já houve orçamento em que o prazo não devia constar.',
  },
  mostrar_cnpj_cliente: {
    rotulo: 'Mostrar CNPJ do cliente',
    dica: 'Já houve orçamento sem CNPJ.',
  },
  mostrar_numero_documento: {
    rotulo: 'Mostrar número do documento',
    dica: 'Já houve orçamento sem número sequencial.',
  },
  agrupar_valor_unico: {
    rotulo: 'Agrupar itens em valor único por grupo',
    dica: 'Ex.: locação + entulho num único valor.',
  },
  versao_pedreiro: {
    rotulo: 'Versão para o pedreiro',
    dica: 'Só descrição e quantidade, sem nenhum valor.',
  },
  destacar_composicao_custo: {
    rotulo: 'Destacar composição do custo',
    dica: 'Texto explicando que material e locação encarecem, sendo a mão de obra a menor parcela.',
  },
}

/** Combinacoes usadas com frequencia, para nao ter de marcar tudo de novo. */
export const PREDEFINIDOS: { nome: string; descricao: string; versao: VersaoExibicao }[] = [
  {
    nome: 'Fechamento ao cliente',
    descricao: 'Sem preço unitário, com subtotal por grupo — o formato preferido.',
    versao: { ...VERSAO_PADRAO },
  },
  {
    nome: 'Detalhado ao cliente',
    descricao: 'Com preço unitário e quantidade item a item.',
    versao: { ...VERSAO_PADRAO, mostrar_preco_unitario: true },
  },
  {
    nome: 'Versão interna',
    descricao: 'Com BDI, margem e todos os valores. Nunca enviar ao cliente.',
    versao: {
      ...VERSAO_PADRAO,
      mostrar_preco_unitario: true,
      mostrar_bdi_margem: true,
    },
  },
  {
    nome: 'Versão para o pedreiro',
    descricao: 'Só descrição e quantidade, sem nenhum valor.',
    versao: {
      ...VERSAO_PADRAO,
      versao_pedreiro: true,
      mostrar_preco_unitario: false,
      mostrar_cnpj_cliente: false,
      mostrar_numero_documento: false,
    },
  },
]

/**
 * Le a versao vinda do banco (jsonb) ou da URL, completando o que faltar com o
 * padrao. Uma versao gravada antes de um campo novo existir continua valendo.
 */
export function lerVersao(bruto: unknown): VersaoExibicao {
  const versao = { ...VERSAO_PADRAO }
  if (!bruto || typeof bruto !== 'object') return versao

  for (const chave of Object.keys(VERSAO_PADRAO) as (keyof VersaoExibicao)[]) {
    const valor = (bruto as Record<string, unknown>)[chave]
    if (typeof valor === 'boolean') versao[chave] = valor
  }

  // A versao do pedreiro nao carrega valor nenhum, custe o que custar.
  if (versao.versao_pedreiro) {
    versao.mostrar_preco_unitario = false
    versao.mostrar_bdi_margem = false
  }
  return versao
}

/** Serializa para a query string, guardando so o que difere do padrao. */
export function versaoParaQuery(versao: VersaoExibicao): string {
  const ligados = (Object.keys(VERSAO_PADRAO) as (keyof VersaoExibicao)[]).filter(
    (c) => versao[c] !== VERSAO_PADRAO[c],
  )
  return ligados.map((c) => `${c}=${versao[c] ? '1' : '0'}`).join('&')
}

export function versaoDaQuery(params: Record<string, string | string[] | undefined>): VersaoExibicao {
  const bruto: Record<string, boolean> = {}
  for (const chave of Object.keys(VERSAO_PADRAO)) {
    const valor = params[chave]
    if (typeof valor === 'string') bruto[chave] = valor === '1' || valor === 'true'
  }
  return lerVersao(bruto)
}

/**
 * Barreira final da regra 11.1: nenhum custo, margem ou BDI aparece em
 * documento de cliente, em nenhuma hipotese. Documento marcado como do cliente
 * tem esses blocos desligados a forca, mesmo que alguem ligue na tela.
 */
export function versaoParaCliente(versao: VersaoExibicao): VersaoExibicao {
  return { ...versao, mostrar_bdi_margem: false }
}

/**
 * Colunas efetivas da tabela de servicos, conforme a versao escolhida.
 * Fica aqui, e nao na tela, porque e o que faz o colSpan das faixas de secao e
 * dos subtotais bater com o cabecalho em qualquer combinacao.
 */
export interface ColunasRelatorio {
  descricao: true
  quantidade: boolean
  preco_unitario: boolean
  valor: boolean
  total: number
}

export function colunasDoRelatorio(versao: VersaoExibicao): ColunasRelatorio {
  const semValor = versao.versao_pedreiro
  const quantidade = versao.mostrar_quantidade_unidade
  const preco_unitario = versao.mostrar_preco_unitario && !semValor
  const valor = !semValor

  return {
    descricao: true,
    quantidade,
    preco_unitario,
    valor,
    total: 1 + (quantidade ? 1 : 0) + (preco_unitario ? 1 : 0) + (valor ? 1 : 0),
  }
}
