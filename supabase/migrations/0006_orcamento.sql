-- =============================================================================
-- Base de precos referenciais e complementos do orcamento (spec 4.13)
--
-- A especificacao pede SINAPI, ORSE e SICRO do Piaui importaveis por CSV, com
-- data-base e codigo da composicao. O modelo do item 9 nao previa onde guardar
-- essas composicoes — e aqui.
-- =============================================================================

create table public.precos_referencia (
  id             uuid primary key default gen_random_uuid(),
  base           public.base_referencia not null,   -- SINAPI | ORSE | SICRO
  codigo         text not null,
  descricao      text not null,
  unidade        text,
  preco_unitario bigint not null default 0,
  -- data-base da tabela publicada (ex.: SINAPI PI 05/2026)
  data_base      date,
  uf             text default 'PI',
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  excluido_em    timestamptz
);

-- a mesma composicao aparece em varias data-bases: o que nao pode repetir e a
-- combinacao base + codigo + data-base + UF
create unique index precos_referencia_unicos
  on public.precos_referencia (base, codigo, coalesce(data_base, '1900-01-01'), coalesce(uf, ''))
  where excluido_em is null;

create index on public.precos_referencia (base, data_base desc);
create index on public.precos_referencia using gin (to_tsvector('portuguese', descricao));

alter table public.precos_referencia enable row level security;

create policy admin_total on public.precos_referencia
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

grant select, insert, update, delete on public.precos_referencia to authenticated;

create trigger t_atualizado_em_precos_referencia
  before update on public.precos_referencia
  for each row execute function public.tocar_atualizado_em();

-- -----------------------------------------------------------------------------
-- Complementos do orcamento
-- -----------------------------------------------------------------------------

-- Aba de pendencias / itens a definir (spec 4.13)
alter table public.itens_orcamento
  add column if not exists pendencia  boolean not null default false,
  add column if not exists observacao text;

comment on column public.itens_orcamento.pendencia is
  'Item ainda a definir; sai na aba de pendencias, nunca no total.';

-- Memorial descritivo, gerado junto com a planilha (spec 4.13)
alter table public.orcamentos
  add column if not exists memorial text,
  add column if not exists margem   numeric(5,4) not null default 0.30;

comment on column public.orcamentos.margem is
  'Margem sobre o custo, usada quando o item nao tem preco unitario proprio.';
