-- =============================================================================
-- 0009 — Desonerada ou nao desonerada, registrado no preco
--
-- O SINAPI publica duas versoes de cada tabela. A desonerada nao carrega o INSS
-- sobre a folha (Lei 12.546/2011), entao todo preco que tem mao de obra sai
-- mais barato. Sao numeros diferentes para o mesmo codigo, no mesmo mes, na
-- mesma UF.
--
-- Sem esta coluna, importar as duas versoes fazia uma sobrescrever a outra em
-- silencio, pela chave unica antiga (base + codigo + data-base + UF). O erro
-- nao apareceria na tela: apareceria no valor de um orcamento.
--
-- A RV trabalha com a NAO desonerada, que e o usual em obra privada. Fica como
-- padrao, e a outra continua importavel sem conflito.
-- =============================================================================

alter table public.precos_referencia
  add column if not exists desonerado boolean not null default false;

comment on column public.precos_referencia.desonerado is
  'true = tabela desonerada (sem INSS sobre a folha). A RV usa a nao desonerada.';

-- A chave unica passa a separar as duas versoes.
drop index if exists precos_referencia_unicos;

create unique index precos_referencia_unicos
  on public.precos_referencia
     (base, codigo, coalesce(data_base, '1900-01-01'), coalesce(uf, ''), desonerado)
  where excluido_em is null;


-- -----------------------------------------------------------------------------
-- O item do orcamento congela o preco no momento em que entra. Passa a congelar
-- tambem DE ONDE aquele preco veio: sem a data-base e a versao, o documento diz
-- "SINAPI 88489" sem dizer qual SINAPI, e ninguem consegue conferir o numero.
-- -----------------------------------------------------------------------------
alter table public.itens_orcamento
  add column if not exists referencia_data_base  date,
  add column if not exists referencia_desonerado boolean;

comment on column public.itens_orcamento.referencia_data_base is
  'Data-base da tabela de onde o preco veio, congelada junto com o preco.';
comment on column public.itens_orcamento.referencia_desonerado is
  'Versao da tabela de onde o preco veio. Nulo em item de preco proprio.';
