-- =============================================================================
-- Quantidade e unidade no servico do fechamento.
--
-- A versao de exibicao do item 4.14 permite "mostrar quantidade e unidade", e o
-- servico importado das medicoes ja nasce com a quantidade executada. Sem estas
-- colunas essa opcao nao teria o que mostrar.
-- =============================================================================

alter table public.servicos_executados
  add column if not exists quantidade numeric(14,4),
  add column if not exists unidade    text;

comment on column public.servicos_executados.quantidade is
  'Quantidade executada; alimenta o preco unitario do relatorio quando informada.';
