# O que ainda falta construir

A ordem da especificação (item 13) manda entregar funcionando do item 1 ao 5 antes de seguir.
Isso está entregue. Este arquivo registra o que resta, na ordem em que deve ser construído.

## 6. Fechamento e relatório de débitos (spec 4.12 e 4.14)

O documento que fecha a conta com o cliente: serviços por frente de trabalho ou por local,
deduções com justificativa, adiantamentos recebidos, notas a repassar, almoxarifado cobrado e o
saldo devedor. Junto vem o seletor de versão de exibição do item 4.14 (mostrar ou esconder preço
unitário, quantidade, BDI, prazo, CNPJ, número do orçamento; agrupar em valor único; versão para
o pedreiro), com a combinação usada salva em cada documento gerado.

As tabelas `servicos_executados` e `documentos` já existem, com `versao_exibicao_json`.

## 7. Almoxarifado (spec 4.10)

Estoque por categoria em caixa alta com faixa destacada, custo unitário e valor de cobrança,
cabo elétrico por pedaço com subtotal por cor e bitola, saídas com marcação de cobrar do cliente
alimentando o fechamento, saída em planilha A4 e PDF.

Tabelas `almoxarifado_itens` e `almoxarifado_saidas` prontas; o painel da obra já soma o
almoxarifado cobrado na receita.

## 8. Medições e terceiros (spec 4.11)

Cadastro do serviço por produção com unidade, quantidade contratada, custo e preço de venda;
lançamento da medição por data e local; terceiros com valor combinado, pago, saldo e comprovante;
item terceirizado "a cotar separadamente".

Tabelas `servicos_medicao`, `medicoes`, `terceiros` e `servicos_terceiros` prontas; o painel da
obra já soma as medições na receita e os terceiros no custo.

## 9. Orçamentos (spec 4.13)

Orçamento rápido e orçamento completo com fases hierárquicas, base de preços referenciais
(SINAPI, ORSE, SICRO) importável por CSV, itens próprios convivendo com itens de referência, BDI
configurável nos três modos de exibição, aba de pendências, memorial descritivo e pesquisa de
preços, saída em xlsx e PDF.

Tabelas `orcamentos` e `itens_orcamento` prontas, incluindo `modo_bdi` e `base_referencia`.

## 11. Arquivos recebidos e galeria de fotos (spec 4.16)

Repositório por cliente e por obra para projetos, contratos, cartão CNPJ e conta de energia, mais
a galeria de fotos da obra com marcação antes/depois.

Tabela `arquivos` pronta, com `galeria` e `momento`; bucket `arquivos` criado.

## 12. Base de preços de material e cotações (spec 6)

Registro da cotação recebida com itens, condição e validade; cotação marcada como base; itens
substituídos e estimados sinalizados; comparativo lado a lado; apuração do custo por m² e sugestão
de preço de venda pela margem.

Tabelas `cotacoes` e `itens_cotacao` prontas.

## 13. Energia solar — o que falta (spec 5.5 a 5.7)

O dimensionamento e a projeção de economia estão prontos e testados. Falta a cotação a partir da
base de preços dos fornecedores (menor preço vigente, sinalização de cotação vencida, troca manual
de fornecedor) e a geração da proposta em xlsx e PDF.

Tabelas `projetos_solar` e `itens_projeto_solar` prontas.

## 14. Locação de equipamentos (spec 7)

Deliberadamente o último. Cadastro de equipamentos, tabela de preços por diária, semana e mês
importável por CSV, contrato de locação, devolução com diárias adicionais, alertas de vencimento e
geração de contrato e recibo em PDF.

Tabelas `equipamentos`, `tabela_locacao`, `contratos_locacao` e `itens_contrato_locacao` prontas.

---

## Fora desta versão

Levantamento de quantitativo a partir de projeto (forro, concreto, aço) — item 14.10 da
especificação.

## Coisas menores anotadas pelo caminho

- **Logo da RV**: os documentos usam um monograma provisório. Suba o arquivo no bucket `publico`
  e cole a URL no parâmetro `empresa_logo_url` para que ele apareça no topo de todo documento.
- **Leitura automática da nota pela foto** (valor, data e CNPJ): a especificação trata como
  desejável, não obrigatório. A entrada manual está feita.
- **Ícones do PWA**: gerados como monograma provisório, mesma observação da logo.
