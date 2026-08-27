-- =============================================================================
-- Teste de permissoes — caso 25 da especificacao:
-- "Entrar como usuario lancador e confirmar que nenhuma tela de custo, margem
--  ou resultado abre."
-- Aqui o teste e mais duro que a tela: verifica que o proprio banco recusa.
-- Rodar com: psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
-- =============================================================================
set client_min_messages to warning;

begin;

-- --- massa de teste -----------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@rv.com'),
  ('22222222-2222-2222-2222-222222222222', 'encarregado@rv.com');

insert into public.usuarios (id, nome, email, perfil) values
  ('11111111-1111-1111-1111-111111111111', 'Rubens', 'admin@rv.com', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Encarregado', 'encarregado@rv.com', 'lancador');

insert into public.clientes (id, nome) values
  ('33333333-3333-3333-3333-333333333333', 'Center Paes');

insert into public.obras (id, cliente_id, nome, valor_contrato, data_inicio) values
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333',
   'Reforma Center Paes', 1096000, '2026-08-03'),
  ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333',
   'Obra que o lancador nao acessa', 5000000, '2026-08-03');

-- o encarregado so esta vinculado a primeira obra
insert into public.usuarios_obras (usuario_id, obra_id) values
  ('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444');

insert into public.funcionarios (id, nome, funcao, valor_diaria, chave_pix) values
  ('66666666-6666-6666-6666-666666666666', 'Antonio', 'pedreiro', 18000, 'pix-antonio');

insert into public.orcamentos (id, obra_id, titulo, bdi, total) values
  ('77777777-7777-7777-7777-777777777777', '44444444-4444-4444-4444-444444444444',
   'Orcamento reforma', 0.25, 2000000);

-- --- entra como LANCADOR ------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

do $$
begin
  if public.eh_admin() then raise exception 'FALHOU: lancador reconhecido como admin'; end if;
  if public.perfil_atual() <> 'lancador' then raise exception 'FALHOU: perfil errado'; end if;
end $$;

-- 1. nao ve valor de contrato (tabela obras e fechada para ele)
do $$
declare n int;
begin
  select count(*) into n from public.obras;
  if n <> 0 then raise exception 'FALHOU: lancador leu % linha(s) de obras', n; end if;
end $$;

-- 2. nao ve orcamento
do $$
declare n int;
begin
  select count(*) into n from public.orcamentos;
  if n <> 0 then raise exception 'FALHOU: lancador leu orcamento'; end if;
end $$;

-- 3. nao ve pagamentos, despesas, almoxarifado, clientes nem diaria/PIX
do $$
declare n int;
begin
  select count(*) into n from public.pagamentos;         if n <> 0 then raise exception 'FALHOU: pagamentos'; end if;
  select count(*) into n from public.despesas_sem_nota;  if n <> 0 then raise exception 'FALHOU: despesas'; end if;
  select count(*) into n from public.almoxarifado_itens; if n <> 0 then raise exception 'FALHOU: almoxarifado'; end if;
  select count(*) into n from public.clientes;           if n <> 0 then raise exception 'FALHOU: clientes'; end if;
  select count(*) into n from public.funcionarios;       if n <> 0 then raise exception 'FALHOU: leu diaria e PIX'; end if;
end $$;

-- 4. ve apenas a obra a que esta vinculado, e sem valor de contrato
do $$
declare n int; v text;
begin
  select count(*) into n from public.obras_visiveis;
  if n <> 1 then raise exception 'FALHOU: lancador deveria ver 1 obra, viu %', n; end if;
  select nome into v from public.obras_visiveis;
  if v <> 'Reforma Center Paes' then raise exception 'FALHOU: obra errada (%)', v; end if;
end $$;

-- a view nao tem a coluna de valor: referenciar valor_contrato e erro de SQL
do $$
begin
  perform valor_contrato from public.obras_visiveis;
  raise exception 'FALHOU: obras_visiveis expos valor_contrato';
exception when undefined_column then null;
end $$;

-- 5. ve a equipe para marcar presenca, sem diaria e sem PIX
do $$
declare n int;
begin
  select count(*) into n from public.funcionarios_visiveis;
  if n <> 1 then raise exception 'FALHOU: equipe nao visivel'; end if;
end $$;

do $$
begin
  perform valor_diaria from public.funcionarios_visiveis;
  raise exception 'FALHOU: funcionarios_visiveis expos valor_diaria';
exception when undefined_column then null;
end $$;

do $$
begin
  perform chave_pix from public.funcionarios_visiveis;
  raise exception 'FALHOU: funcionarios_visiveis expos chave_pix';
exception when undefined_column then null;
end $$;

-- 6. lanca presenca na obra dele — o valor da diaria vem do servidor
do $$
declare v_id uuid; v_valor bigint; v_tipo public.tipo_diaria;
begin
  v_id := public.registrar_presenca(
    '44444444-4444-4444-4444-444444444444',
    '66666666-6666-6666-6666-666666666666',
    date '2026-08-03');
  select valor_diaria into v_valor from public.lancamentos_diarios where id = v_id;
  if v_valor <> 18000 then raise exception 'FALHOU: diaria resolvida como %', v_valor; end if;

  v_id := public.registrar_presenca(
    '44444444-4444-4444-4444-444444444444',
    '66666666-6666-6666-6666-666666666666',
    date '2026-08-04', 'meia');
  select valor_diaria into v_valor from public.lancamentos_diarios where id = v_id;
  if v_valor <> 9000 then raise exception 'FALHOU: meia diaria = %', v_valor; end if;

  -- lancador nao consegue inflar a diaria: o parametro e ignorado para ele
  v_id := public.registrar_presenca(
    '44444444-4444-4444-4444-444444444444',
    '66666666-6666-6666-6666-666666666666',
    date '2026-08-05', 'cheia', 0, null, 99999900);
  select valor_diaria into v_valor from public.lancamentos_diarios where id = v_id;
  if v_valor <> 18000 then raise exception 'FALHOU: lancador editou a diaria (%)', v_valor; end if;

  v_id := public.registrar_presenca(
    '44444444-4444-4444-4444-444444444444',
    '66666666-6666-6666-6666-666666666666',
    date '2026-08-06', 'sem_diaria');
  select valor_diaria, tipo_diaria into v_valor, v_tipo from public.lancamentos_diarios where id = v_id;
  if v_valor <> 0 or v_tipo <> 'sem_diaria' then raise exception 'FALHOU: sem_diaria'; end if;
end $$;

-- 7. nao lanca em obra a que nao esta vinculado
do $$
begin
  begin
    perform public.registrar_presenca(
      '55555555-5555-5555-5555-555555555555',
      '66666666-6666-6666-6666-666666666666',
      date '2026-08-03');
    raise exception 'FALHOU: lancou em obra sem vinculo';
  exception when raise_exception then
    if sqlerrm <> 'sem acesso a esta obra' then raise; end if;
  end;
end $$;

-- 8. duas presencas do mesmo funcionario no mesmo dia viram uma so
do $$
declare n int;
begin
  perform public.registrar_presenca(
    '44444444-4444-4444-4444-444444444444',
    '66666666-6666-6666-6666-666666666666',
    date '2026-08-03');
  select count(*) into n from public.lancamentos_diarios
   where data = date '2026-08-03' and excluido_em is null;
  if n <> 1 then raise exception 'FALHOU: % lancamentos no mesmo dia', n; end if;
end $$;

-- 9. quentinha do dia usa o valor de parametros quando nao informado
do $$
declare v_id uuid; v bigint; q int;
begin
  v_id := public.registrar_quentinha('44444444-4444-4444-4444-444444444444', date '2026-08-03', 4);
  select valor_unitario, quantidade into v, q from public.quentinhas where id = v_id;
  if v <> 1800 or q <> 4 then raise exception 'FALHOU: quentinha % x %', q, v; end if;
end $$;

-- 10. a semana foi criada e numerada a partir do inicio da obra
do $$
declare n int; num int; ini date;
begin
  select count(*) into n from public.semanas;
  if n <> 1 then raise exception 'FALHOU: % semanas criadas', n; end if;
  select numero, data_inicio into num, ini from public.semanas;
  if num <> 1 then raise exception 'FALHOU: semana numerada como %', num; end if;
  if ini <> date '2026-08-03' then raise exception 'FALHOU: semana comeca em %', ini; end if;
end $$;

-- 11. exclusao e logica: remover presenca nao apaga a linha
do $$
declare n int;
begin
  perform public.remover_presenca(
    '44444444-4444-4444-4444-444444444444',
    '66666666-6666-6666-6666-666666666666',
    date '2026-08-06');
  select count(*) into n from public.lancamentos_diarios
   where data = date '2026-08-06' and excluido_em is not null;
  if n <> 1 then raise exception 'FALHOU: exclusao nao foi logica'; end if;
end $$;

-- --- entra como ADMIN ---------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare n int; v bigint;
begin
  if not public.eh_admin() then raise exception 'FALHOU: admin nao reconhecido'; end if;

  select count(*) into n from public.obras;
  if n <> 2 then raise exception 'FALHOU: admin viu % obras', n; end if;

  select valor_contrato into v from public.obras where id = '44444444-4444-4444-4444-444444444444';
  if v <> 1096000 then raise exception 'FALHOU: admin nao leu valor de contrato'; end if;

  select count(*) into n from public.orcamentos;
  if n <> 1 then raise exception 'FALHOU: admin nao leu orcamento'; end if;

  select count(*) into n from public.obras_visiveis;
  if n <> 2 then raise exception 'FALHOU: admin viu % obras na view', n; end if;
end $$;

-- 12. o admin edita o valor da diaria no lancamento
do $$
declare v_id uuid; v bigint;
begin
  v_id := public.registrar_presenca(
    '44444444-4444-4444-4444-444444444444',
    '66666666-6666-6666-6666-666666666666',
    date '2026-08-07', 'cheia', 0, 'chegou fora do horario', 12000);
  select valor_diaria into v from public.lancamentos_diarios where id = v_id;
  if v <> 12000 then raise exception 'FALHOU: admin nao editou o valor (%)', v; end if;
end $$;

-- 13. semana fechada bloqueia novo lancamento
do $$
begin
  update public.semanas set status = 'fechada', fechada_em = now();
  begin
    perform public.registrar_presenca(
      '44444444-4444-4444-4444-444444444444',
      '66666666-6666-6666-6666-666666666666',
      date '2026-08-08');
    raise exception 'FALHOU: lancou em semana fechada';
  exception when raise_exception then
    if sqlerrm <> 'semana ja fechada' then raise; end if;
  end;
end $$;

reset role;
rollback;

\echo 'RLS TESTS OK'
