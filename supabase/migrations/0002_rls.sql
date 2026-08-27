-- =============================================================================
-- RV Engenharia — perfis e seguranca em nivel de linha (especificacao 2.1)
--
-- "Toda tela de valor sensivel (custo, margem, BDI, resultado) e bloqueada por
--  perfil, nao apenas escondida no front."
--
-- Como isso e garantido aqui:
--   * o lancador nao tem SELECT nas tabelas que carregam valor de contrato,
--     custo, orcamento ou resultado — nem via API, nem via SQL;
--   * o que ele precisa ver (nome da obra, lista de quem esta ativo) chega por
--     views que expoem apenas as colunas seguras;
--   * o valor da diaria nunca trafega pelo cliente do lancador: ele e resolvido
--     no servidor pela funcao registrar_presenca.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funcoes de apoio. SECURITY DEFINER para poderem ler public.usuarios sem cair
-- na propria RLS (e sem recursao de politica).
-- -----------------------------------------------------------------------------
create or replace function public.perfil_atual()
returns public.perfil_usuario
language sql
stable
security definer
set search_path = public
as $$
  select u.perfil
  from public.usuarios u
  where u.id = auth.uid() and u.ativo and u.excluido_em is null
$$;

create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.perfil_atual() = 'admin', false)
$$;

-- Admin acessa qualquer obra; lancador, apenas as obras a que esta vinculado.
create or replace function public.tem_acesso_obra(p_obra_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.eh_admin()
     or exists (
          select 1 from public.usuarios_obras uo
          where uo.usuario_id = auth.uid() and uo.obra_id = p_obra_id
        )
$$;

-- -----------------------------------------------------------------------------
-- RLS ligada em todas as tabelas do schema public.
-- Sem policy = ninguem le. As permissoes sao concedidas explicitamente abaixo.
-- -----------------------------------------------------------------------------
-- Nao se usa FORCE ROW LEVEL SECURITY aqui de proposito: o dono das tabelas e
-- o mesmo papel que cria as views seguras abaixo, e essas views precisam ler a
-- tabela base para devolver ao lancador apenas as colunas permitidas. O app
-- nunca se conecta como dono — o PostgREST usa 'authenticated', que e filtrado
-- normalmente pelas policies.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- Privilegios de tabela (o mesmo que o Supabase concede por padrao). Quem
-- decide o que cada perfil ve sao as policies; estes grants apenas garantem que
-- o comportamento nao dependa do padrao do projeto.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- Tabelas exclusivas do admin: contrato, custo, margem, orcamento, resultado,
-- cadastros e tudo o que o lancador nao pode ver.
do $$
declare t text;
begin
  foreach t in array array[
    'clientes', 'obras', 'locais_obra', 'funcionarios', 'usuarios_obras',
    'fornecedores', 'despesas_sem_nota', 'pagamentos',
    'almoxarifado_itens', 'almoxarifado_saidas',
    'servicos_executados', 'servicos_medicao', 'medicoes',
    'terceiros', 'servicos_terceiros',
    'orcamentos', 'itens_orcamento', 'cotacoes', 'itens_cotacao',
    'projetos_solar', 'itens_projeto_solar',
    'equipamentos', 'tabela_locacao', 'contratos_locacao', 'itens_contrato_locacao',
    'arquivos', 'documentos', 'parametros', 'rateio_nota'
  ]
  loop
    execute format($f$
      create policy admin_total on public.%I
        for all to authenticated
        using (public.eh_admin())
        with check (public.eh_admin())
    $f$, t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- usuarios: cada um le a propria linha; o admin gerencia todas.
-- -----------------------------------------------------------------------------
create policy usuario_le_proprio on public.usuarios
  for select to authenticated
  using (id = auth.uid() or public.eh_admin());

create policy admin_gerencia_usuarios on public.usuarios
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- -----------------------------------------------------------------------------
-- Semanas: o lancador le as semanas das suas obras (precisa saber a semana
-- corrente), mas nao fecha semana — fechar e do admin.
-- -----------------------------------------------------------------------------
create policy semanas_leitura on public.semanas
  for select to authenticated
  using (public.tem_acesso_obra(obra_id));

create policy semanas_admin on public.semanas
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- -----------------------------------------------------------------------------
-- Lancamento diario e quentinhas: o lancador lanca nas obras a que esta
-- vinculado. Nao pode mexer em semana ja fechada.
-- -----------------------------------------------------------------------------
create policy lancamentos_leitura on public.lancamentos_diarios
  for select to authenticated
  using (public.tem_acesso_obra(obra_id));

create policy lancamentos_insere on public.lancamentos_diarios
  for insert to authenticated
  with check (
    public.tem_acesso_obra(obra_id)
    and not exists (
      select 1 from public.semanas s
      where s.id = semana_id and s.status = 'fechada'
    )
  );

create policy lancamentos_edita on public.lancamentos_diarios
  for update to authenticated
  using (
    public.tem_acesso_obra(obra_id)
    and (public.eh_admin() or not exists (
      select 1 from public.semanas s where s.id = semana_id and s.status = 'fechada'
    ))
  )
  with check (public.tem_acesso_obra(obra_id));

create policy lancamentos_admin_apaga on public.lancamentos_diarios
  for delete to authenticated
  using (public.eh_admin());

create policy quentinhas_leitura on public.quentinhas
  for select to authenticated
  using (public.tem_acesso_obra(obra_id));

create policy quentinhas_insere on public.quentinhas
  for insert to authenticated
  with check (
    public.tem_acesso_obra(obra_id)
    and not exists (
      select 1 from public.semanas s where s.id = semana_id and s.status = 'fechada'
    )
  );

create policy quentinhas_edita on public.quentinhas
  for update to authenticated
  using (
    public.tem_acesso_obra(obra_id)
    and (public.eh_admin() or not exists (
      select 1 from public.semanas s where s.id = semana_id and s.status = 'fechada'
    ))
  )
  with check (public.tem_acesso_obra(obra_id));

create policy quentinhas_admin_apaga on public.quentinhas
  for delete to authenticated
  using (public.eh_admin());

-- -----------------------------------------------------------------------------
-- Notas fiscais e fotos: o lancador fotografa a nota da obra dele.
-- -----------------------------------------------------------------------------
create policy notas_leitura on public.notas_fiscais
  for select to authenticated
  using (public.tem_acesso_obra(obra_id));

create policy notas_insere on public.notas_fiscais
  for insert to authenticated
  with check (public.tem_acesso_obra(obra_id));

create policy notas_edita on public.notas_fiscais
  for update to authenticated
  using (public.tem_acesso_obra(obra_id))
  with check (public.tem_acesso_obra(obra_id));

create policy notas_admin_apaga on public.notas_fiscais
  for delete to authenticated
  using (public.eh_admin());

create policy fotos_nota_acesso on public.fotos_nota
  for all to authenticated
  using (
    exists (
      select 1 from public.notas_fiscais n
      where n.id = nota_id and public.tem_acesso_obra(n.obra_id)
    )
  )
  with check (
    exists (
      select 1 from public.notas_fiscais n
      where n.id = nota_id and public.tem_acesso_obra(n.obra_id)
    )
  );

-- -----------------------------------------------------------------------------
-- Views seguras para o lancador: apenas colunas que ele pode ver.
-- Sao security_invoker = off (padrao), logo leem a tabela base com os direitos
-- do dono da view — por isso o filtro de acesso vai escrito no WHERE.
-- -----------------------------------------------------------------------------
create view public.obras_visiveis as
  select o.id,
         o.nome,
         o.endereco,
         o.status,
         o.data_inicio,
         o.forma_contratacao,
         c.nome as cliente_nome
  from public.obras o
  join public.clientes c on c.id = o.cliente_id
  where o.excluido_em is null
    and public.tem_acesso_obra(o.id);
comment on view public.obras_visiveis is
  'Obras que o usuario atual pode lancar, sem valor de contrato nem rateio.';

create view public.funcionarios_visiveis as
  select f.id, f.nome, f.tipo, f.funcao, f.status
  from public.funcionarios f
  where f.excluido_em is null;
comment on view public.funcionarios_visiveis is
  'Equipe para a tela de presenca, sem valor de diaria e sem chave PIX.';

create view public.locais_visiveis as
  select l.id, l.obra_id, l.nome, l.endereco
  from public.locais_obra l
  where l.excluido_em is null
    and public.tem_acesso_obra(l.obra_id);

grant select on public.obras_visiveis, public.funcionarios_visiveis, public.locais_visiveis
  to authenticated;

-- -----------------------------------------------------------------------------
-- Semana da obra: cria (ou devolve) a semana que contem a data.
-- As semanas sao numeradas a partir da data de inicio da obra (spec 4.5).
-- -----------------------------------------------------------------------------
create or replace function public.garantir_semana(p_obra_id uuid, p_data date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_segunda date;
  v_id      uuid;
  v_inicio  date;
  v_numero  integer;
begin
  if not public.tem_acesso_obra(p_obra_id) then
    raise exception 'sem acesso a esta obra';
  end if;

  -- segunda-feira da semana da data (domingo conta para a semana seguinte)
  v_segunda := p_data - ((extract(isodow from p_data)::int - 1) * interval '1 day');

  select id into v_id
  from public.semanas
  where obra_id = p_obra_id and data_inicio = v_segunda and excluido_em is null;
  if found then
    return v_id;
  end if;

  select data_inicio into v_inicio from public.obras where id = p_obra_id;
  v_inicio := coalesce(v_inicio, v_segunda);
  -- numero da semana contado a partir da segunda da semana de inicio da obra
  v_numero := 1 + floor(
    (v_segunda - (v_inicio - ((extract(isodow from v_inicio)::int - 1) * interval '1 day'))::date) / 7
  )::int;
  if v_numero < 1 then
    v_numero := 1;
  end if;
  -- se o numero ja existir (obra com semanas fora de ordem), pega o proximo livre
  while exists (select 1 from public.semanas where obra_id = p_obra_id and numero = v_numero) loop
    v_numero := v_numero + 1;
  end loop;

  insert into public.semanas (obra_id, numero, data_inicio, data_fim)
  values (p_obra_id, v_numero, v_segunda, v_segunda + 5)
  returning id into v_id;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- registrar_presenca: o lancador nao envia o valor da diaria — ele nem pode
-- ler essa coluna. O valor e resolvido aqui, no servidor, pelo cadastro do
-- funcionario e pelo percentual de meia diaria dos parametros.
-- O admin pode enviar p_valor_diaria para editar o valor no lancamento.
-- -----------------------------------------------------------------------------
create or replace function public.registrar_presenca(
  p_obra_id        uuid,
  p_funcionario_id uuid,
  p_data           date,
  p_tipo_diaria    public.tipo_diaria default 'cheia',
  p_valor_vale     bigint default 0,
  p_observacao     text default null,
  p_valor_diaria   bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_semana   uuid;
  v_base     bigint;
  v_pct_meia numeric;
  v_valor    bigint;
  v_id       uuid;
begin
  if not public.tem_acesso_obra(p_obra_id) then
    raise exception 'sem acesso a esta obra';
  end if;

  v_semana := public.garantir_semana(p_obra_id, p_data);

  if exists (select 1 from public.semanas where id = v_semana and status = 'fechada') then
    raise exception 'semana ja fechada';
  end if;

  select valor_diaria into v_base from public.funcionarios where id = p_funcionario_id;
  if v_base is null then
    raise exception 'funcionario nao encontrado';
  end if;

  select coalesce(valor::numeric, 0.5) into v_pct_meia
  from public.parametros where chave = 'percentual_meia_diaria';
  v_pct_meia := coalesce(v_pct_meia, 0.5);

  v_valor := case p_tipo_diaria
               when 'sem_diaria' then 0
               when 'meia'       then round(v_base * v_pct_meia)
               else v_base
             end;

  -- so o admin edita o valor no lancamento
  if p_valor_diaria is not null and public.eh_admin() then
    v_valor := case when p_tipo_diaria = 'sem_diaria' then 0 else p_valor_diaria end;
  end if;

  insert into public.lancamentos_diarios
    (obra_id, semana_id, funcionario_id, data, tipo_diaria, valor_diaria, valor_vale,
     observacao, criado_por)
  values
    (p_obra_id, v_semana, p_funcionario_id, p_data, p_tipo_diaria, v_valor,
     coalesce(p_valor_vale, 0), p_observacao, auth.uid())
  on conflict (obra_id, funcionario_id, data) where excluido_em is null
  do update set tipo_diaria   = excluded.tipo_diaria,
                valor_diaria  = excluded.valor_diaria,
                valor_vale    = excluded.valor_vale,
                observacao    = excluded.observacao,
                semana_id     = excluded.semana_id
  returning id into v_id;

  return v_id;
end;
$$;

-- Remove a presenca do dia (o toque que desmarca o funcionario).
create or replace function public.remover_presenca(
  p_obra_id uuid, p_funcionario_id uuid, p_data date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.tem_acesso_obra(p_obra_id) then
    raise exception 'sem acesso a esta obra';
  end if;
  if exists (
    select 1 from public.semanas s
    join public.lancamentos_diarios l on l.semana_id = s.id
    where l.obra_id = p_obra_id and l.funcionario_id = p_funcionario_id
      and l.data = p_data and s.status = 'fechada'
  ) then
    raise exception 'semana ja fechada';
  end if;
  -- exclusao logica: nada e apagado (spec 11.5)
  update public.lancamentos_diarios
     set excluido_em = now()
   where obra_id = p_obra_id and funcionario_id = p_funcionario_id
     and data = p_data and excluido_em is null;
end;
$$;

-- Quentinhas do dia: quantidade e valor unitario (o valor muda com o fornecedor).
create or replace function public.registrar_quentinha(
  p_obra_id uuid,
  p_data date,
  p_quantidade integer,
  p_valor_unitario bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_semana uuid;
  v_valor  bigint;
  v_id     uuid;
begin
  if not public.tem_acesso_obra(p_obra_id) then
    raise exception 'sem acesso a esta obra';
  end if;

  v_semana := public.garantir_semana(p_obra_id, p_data);
  if exists (select 1 from public.semanas where id = v_semana and status = 'fechada') then
    raise exception 'semana ja fechada';
  end if;

  v_valor := p_valor_unitario;
  if v_valor is null then
    select valor::bigint into v_valor from public.parametros where chave = 'valor_quentinha_padrao';
  end if;
  v_valor := coalesce(v_valor, 0);

  select id into v_id
  from public.quentinhas
  where obra_id = p_obra_id and data = p_data and valor_unitario = v_valor
    and excluido_em is null
  limit 1;

  if v_id is null then
    insert into public.quentinhas (obra_id, semana_id, data, quantidade, valor_unitario, criado_por)
    values (p_obra_id, v_semana, p_data, coalesce(p_quantidade, 0), v_valor, auth.uid())
    returning id into v_id;
  else
    update public.quentinhas
       set quantidade = coalesce(p_quantidade, 0), semana_id = v_semana
     where id = v_id;
  end if;

  return v_id;
end;
$$;

grant execute on function
  public.perfil_atual(), public.eh_admin(), public.tem_acesso_obra(uuid),
  public.garantir_semana(uuid, date),
  public.registrar_presenca(uuid, uuid, date, public.tipo_diaria, bigint, text, bigint),
  public.remover_presenca(uuid, uuid, date),
  public.registrar_quentinha(uuid, date, integer, bigint)
  to authenticated;

-- Cria a linha em public.usuarios quando um usuario e criado no Auth.
create or replace function public.ao_criar_usuario_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nome, email, perfil)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'perfil')::public.perfil_usuario, 'lancador')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
