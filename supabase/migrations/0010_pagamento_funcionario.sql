-- =============================================================================
-- 0010 — Pagamento da semana ao funcionario, com comprovante
--
-- A tela de recibos ja existia, mas ela so imprime o papel que vai junto com o
-- Pix. Nao registrava nada: depois de mandar dez Pix numa sexta-feira, o
-- aplicativo continuava sem saber quem foi pago, quando, e por qual valor.
--
-- Isto e o outro lado do dinheiro. A tabela `pagamentos` guarda o que o CLIENTE
-- paga a RV; esta guarda o que a RV paga ao FUNCIONARIO. Sao movimentos
-- opostos e nao podem morar na mesma tabela.
--
-- Uma linha por pagamento, e nao por semana: um funcionario pode receber em
-- duas vezes, ou receber duas semanas juntas. O que vale e a soma.
-- =============================================================================

create table if not exists public.pagamentos_funcionario (
  id              uuid primary key default gen_random_uuid(),
  obra_id         uuid not null references public.obras (id) on delete cascade,
  -- a semana que esta sendo paga; nulo quando o pagamento nao e de semana
  -- fechada (adiantamento, acerto de saida)
  semana_id       uuid references public.semanas (id) on delete set null,
  funcionario_id  uuid not null references public.funcionarios (id),
  valor           bigint not null default 0,
  data_pagamento  date not null default current_date,
  forma_pagamento text,                  -- Pix, especie, transferencia
  comprovante_url text,
  observacao      text,
  criado_por      uuid references public.usuarios (id),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  excluido_em     timestamptz
);

comment on table public.pagamentos_funcionario is
  'O que a RV pagou ao funcionario. Nao confundir com `pagamentos`, que e o que o cliente paga a RV.';

create index if not exists pagamentos_funcionario_por_semana
  on public.pagamentos_funcionario (semana_id) where excluido_em is null;
create index if not exists pagamentos_funcionario_por_obra
  on public.pagamentos_funcionario (obra_id, data_pagamento) where excluido_em is null;


-- -----------------------------------------------------------------------------
-- Permissao: so o administrador. O lancador marca presenca e nao ve valor —
-- deixar o pagamento visivel para ele mostraria, por tabela, quanto cada
-- colega ganha.
-- -----------------------------------------------------------------------------
alter table public.pagamentos_funcionario enable row level security;

drop policy if exists admin_total on public.pagamentos_funcionario;
create policy admin_total on public.pagamentos_funcionario
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

grant select, insert, update, delete on public.pagamentos_funcionario to authenticated;

drop trigger if exists tg_pagamentos_funcionario_atualizado on public.pagamentos_funcionario;
create trigger tg_pagamentos_funcionario_atualizado
  before update on public.pagamentos_funcionario
  for each row execute function public.tocar_atualizado_em();
