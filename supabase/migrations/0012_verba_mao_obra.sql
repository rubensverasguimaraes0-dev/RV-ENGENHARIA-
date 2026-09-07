-- =============================================================================
-- Verba de mao de obra da obra
--
-- O relatorio interno de mao de obra (documentos/padrao/) compara o que saiu do
-- caixa com a verba de mao de obra prevista no orcamento — na obra da Revest,
-- R$ 3.500,00 de uma proposta de R$ 10.960,00 — e mostra o saldo remanescente,
-- que e o que os parceiros de execucao dividem.
--
-- Ate agora a obra so guardava o valor total do contrato, e essa verba nao
-- tinha onde morar. Zero significa "nao informada": o relatorio simplesmente
-- omite o bloco de saldo.
-- =============================================================================

alter table public.obras
  add column if not exists verba_mao_obra bigint not null default 0;

comment on column public.obras.verba_mao_obra is
  'Verba de mao de obra prevista no orcamento, em centavos. Zero = nao informada.';
