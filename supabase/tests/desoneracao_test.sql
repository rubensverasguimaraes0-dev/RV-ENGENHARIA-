-- =============================================================================
-- Teste da separacao desonerada / nao desonerada (migration 0009).
--
-- Prova o que o bug faria: o mesmo codigo, no mesmo mes, na mesma UF, tem preco
-- diferente nas duas versoes da tabela. Antes da 0009 uma sobrescrevia a outra
-- em silencio, e o erro so apareceria no valor de um orcamento.
-- =============================================================================
set client_min_messages to warning;
begin;

insert into public.precos_referencia (base, codigo, descricao, unidade, preco_unitario, data_base, uf, desonerado) values
  ('SINAPI', '88489', 'Pedreiro com encargos complementares', 'H', 2874, '2026-04-01', 'PI', false),
  ('SINAPI', '88489', 'Pedreiro com encargos complementares', 'H', 2415, '2026-04-01', 'PI', true);

do $$
declare v_qtd int; v_nao bigint; v_sim bigint;
begin
  select count(*) into v_qtd from public.precos_referencia
   where base = 'SINAPI' and codigo = '88489' and data_base = '2026-04-01' and uf = 'PI';
  if v_qtd <> 2 then
    raise exception 'FALHOU: as duas versoes deviam conviver; sobraram %', v_qtd;
  end if;

  select preco_unitario into v_nao from public.precos_referencia
   where codigo = '88489' and desonerado = false;
  select preco_unitario into v_sim from public.precos_referencia
   where codigo = '88489' and desonerado = true;
  if v_nao <> 2874 or v_sim <> 2415 then
    raise exception 'FALHOU: precos trocados (nao=% sim=%)', v_nao, v_sim;
  end if;

  raise notice 'OK: as duas versoes convivem com precos proprios';
end $$;

-- e a mesma versao, repetida, continua sendo uma linha so
insert into public.precos_referencia (base, codigo, descricao, unidade, preco_unitario, data_base, uf, desonerado)
values ('SINAPI', '88489', 'Pedreiro', 'H', 9999, '2026-04-01', 'PI', false)
on conflict do nothing;

do $$
declare v_qtd int;
begin
  select count(*) into v_qtd from public.precos_referencia
   where codigo = '88489' and desonerado = false;
  if v_qtd <> 1 then
    raise exception 'FALHOU: a mesma versao duplicou (% linhas)', v_qtd;
  end if;
end $$;

-- o item do orcamento congela de onde o preco veio
do $$
declare v_col int;
begin
  select count(*) into v_col from information_schema.columns
   where table_schema = 'public' and table_name = 'itens_orcamento'
     and column_name in ('referencia_data_base', 'referencia_desonerado');
  if v_col <> 2 then
    raise exception 'FALHOU: o item do orcamento nao congela a origem do preco';
  end if;
end $$;

rollback;
\echo 'TESTE DA DESONERACAO: OK'
