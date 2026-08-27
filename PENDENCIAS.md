# Pendências

Os catorze itens da ordem de construção da especificação estão entregues. O que resta não é
código — são duas coisas que dependem de material seu, e uma que a própria especificação deixou
de fora.

## Precisa de você

**A logo da RV.** Os documentos e os ícones do app usam um monograma provisório. Suba o arquivo no
bucket `publico` do Supabase e cole a URL no parâmetro `empresa_logo_url`, em Cadastros →
Parâmetros. Ela passa a aparecer no topo de todo documento gerado. Os ícones do PWA
(`public/icons/`) podem ser substituídos pelos arquivos definitivos no mesmo formato.

**As tabelas de preço.** Três bases entram por CSV e ainda estão vazias:

- SINAPI, ORSE e SICRO do Piauí, em Cadastros → Preços referenciais;
- as cotações dos fornecedores, em Cadastros → Base de preços — é ela que alimenta a cotação
  solar, então o módulo solar só monta a proposta depois que ela tiver preço de módulo, inversor,
  estrutura, cabo, string box e material elétrico;
- os cerca de 85 itens da tabela de locação, em Locação → Equipamentos.

Os três importadores aceitam o CSV exportado direto do Excel, com ponto e vírgula e decimal com
vírgula.

## Decisão sua, já implementada dos dois jeitos

**A base do rateio com o parceiro** (item 14.2 da especificação). É configurável obra a obra, em
Cadastros → Obras, e está explicada no README. A tela de Resultado mostra as duas apurações
separadas, então dá para olhar os números de uma obra real antes de decidir.

## Fora desta versão

Levantamento de quantitativo a partir de projeto — forro, concreto, aço. É o item 14.10 da
especificação, que já o coloca fora do escopo desta versão.

## Confirmações da seção 14 que seguiram o padrão indicado

Todas implementadas como a especificação sugeriu, e todas ajustáveis sem mexer no código:

1. meia diária a 50%, editável pelo administrador no próprio lançamento;
2. rateio com o parceiro — ver acima;
3. recibo de pagamento do funcionário: incluído;
4. custo unitário no almoxarifado: incluído, e separado do valor de cobrança;
5. galeria de fotos da obra: incluída, com marcação antes/depois;
6. perfil de lançador: incluído, com o bloqueio garantido no banco;
7. orçamento com SINAPI/ORSE/SICRO e BDI: incluído;
8. base de preços de material: incluída;
9. módulo de locação: incluído, construído por último, como pedido.
