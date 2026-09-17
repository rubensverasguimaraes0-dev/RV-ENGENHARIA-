-- =============================================================================
-- Extras do dia e bonus de producao
--
-- Duas coisas que a obra passou a ter em setembro e que o app nao sabia guardar:
--
--  * EXTRAS — outros consumos do dia, alem da quentinha: gelo, taxa de entrega.
--    Quantidade e preco variam de um dia para o outro (2 x R$ 6,00 num dia,
--    1 x R$ 7,00 no outro), entao nao da para fixar em parametro: cada dia
--    guarda o seu.
--
--  * BONUS DE PRODUCAO — quando a equipe combina receber a semana inteira se
--    concluir o servico antes, e conclui, os dias restantes viram bonus. Ele
--    entra em mao de obra, em linha separada, no dia da conclusao, e NAO conta
--    como presenca: a pessoa pode fechar a semana com 5 presencas e 2 de bonus.
--
-- Dinheiro em centavos, como no resto do banco. O valor do bonus fica congelado
-- na linha, do mesmo jeito que valor_diaria no lancamento: a diaria do
-- funcionario pode mudar depois, e o que foi pago nao muda.
-- =============================================================================

create table if not exists public.extras_dia (
  id              uuid primary key default gen_random_uuid(),
  obra_id         uuid not null references public.obras (id) on delete cascade,
  semana_id       uuid references public.semanas (id) on delete set null,
  data            date not null,
  descricao       text not null,
  quantidade      numeric(10,2) not null default 1,
  valor_unitario  bigint not null default 0,
  criado_por      uuid references public.usuarios (id),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  excluido_em     timestamptz
);

comment on table public.extras_dia is
  'Outros consumos do dia alem da quentinha (gelo, taxa de entrega). Valor em centavos.';

create index if not exists extras_dia_por_data
  on public.extras_dia (obra_id, data) where excluido_em is null;

create table if not exists public.bonus_producao (
  id              uuid primary key default gen_random_uuid(),
  obra_id         uuid not null references public.obras (id) on delete cascade,
  semana_id       uuid references public.semanas (id) on delete set null,
  data            date not null,
  funcionario_id  uuid not null references public.funcionarios (id),
  descricao       text not null,
  diarias         numeric(6,2) not null default 0,
  valor           bigint not null default 0,
  criado_por      uuid references public.usuarios (id),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  excluido_em     timestamptz
);

comment on table public.bonus_producao is
  'Bonus por servico concluido antes do prazo. Entra em mao de obra e nao conta presenca.';
comment on column public.bonus_producao.valor is
  'Centavos, congelado no lancamento: diarias x diaria cheia do funcionario na data.';

create index if not exists bonus_producao_por_data
  on public.bonus_producao (obra_id, data) where excluido_em is null;

-- -----------------------------------------------------------------------------
-- Permissoes: mesmo desenho das quentinhas — o lancador lanca nas obras a que
-- tem acesso e nao mexe em semana fechada; o administrador pode tudo.
-- -----------------------------------------------------------------------------

alter table public.extras_dia      enable row level security;
alter table public.bonus_producao  enable row level security;

do $politicas$
declare
  t text;
begin
  foreach t in array array['extras_dia', 'bonus_producao'] loop
    execute format('drop policy if exists %I_leitura on public.%I', t, t);
    execute format($p$
      create policy %I_leitura on public.%I
        for select to authenticated
        using (public.tem_acesso_obra(obra_id))
    $p$, t, t);

    execute format('drop policy if exists %I_insere on public.%I', t, t);
    execute format($p$
      create policy %I_insere on public.%I
        for insert to authenticated
        with check (
          public.tem_acesso_obra(obra_id)
          and not exists (
            select 1 from public.semanas s where s.id = semana_id and s.status = 'fechada'
          )
        )
    $p$, t, t);

    execute format('drop policy if exists %I_edita on public.%I', t, t);
    execute format($p$
      create policy %I_edita on public.%I
        for update to authenticated
        using (
          public.tem_acesso_obra(obra_id)
          and (public.eh_admin() or not exists (
            select 1 from public.semanas s where s.id = semana_id and s.status = 'fechada'
          ))
        )
        with check (public.tem_acesso_obra(obra_id))
    $p$, t, t);

    execute format('drop policy if exists %I_admin_apaga on public.%I', t, t);
    execute format($p$
      create policy %I_admin_apaga on public.%I
        for delete to authenticated
        using (public.eh_admin())
    $p$, t, t);

    execute format('drop trigger if exists tg_%I_atualizado on public.%I', t, t);
    execute format($p$
      create trigger tg_%I_atualizado before update on public.%I
        for each row execute function public.tocar_atualizado_em()
    $p$, t, t);
  end loop;
end
$politicas$;
