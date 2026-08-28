-- =============================================================================
-- Teste da view de identidade da empresa (migration 0008).
--
-- Prova as duas metades da regra: o lancador PRECISA ler nome, logo e CREA
-- para o app e os documentos sairem com a cara da empresa, e NAO PODE ler
-- margem, BDI nem meia diaria (regra 11.1).
--
-- Rodar depois do instalar.sql:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/identidade_test.sql
-- =============================================================================
set client_min_messages to warning;
begin;

insert into auth.users (id, email) values
  ('22222222-2222-2222-2222-222222222222', 'encarregado@rv.com');
-- a linha em public.usuarios nasce pelo gatilho, ja como lancador

update public.parametros set valor = 'https://projeto.supabase.co/publico/rv.png'
 where chave = 'empresa_logo_url';

-- vira o lancador
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

do $$
declare
  v_logo text;
  v_chaves int;
  v_vazou int;
begin
  select valor into v_logo from public.identidade_visivel where chave = 'empresa_logo_url';
  if v_logo is distinct from 'https://projeto.supabase.co/publico/rv.png' then
    raise exception 'FALHOU: o lancador nao consegue ler a logo (veio %)', coalesce(v_logo, '<nada>');
  end if;

  select count(*) into v_chaves from public.identidade_visivel;
  if v_chaves <> 9 then
    raise exception 'FALHOU: a view devia expor 9 chaves de identidade, expos %', v_chaves;
  end if;

  -- e o que NAO pode vazar continua barrado
  select count(*) into v_vazou from public.identidade_visivel
   where chave in ('margem_padrao', 'bdi_padrao', 'percentual_meia_diaria', 'solar_margem');
  if v_vazou <> 0 then
    raise exception 'FALHOU: a view expos % chave(s) de custo/margem', v_vazou;
  end if;

  select count(*) into v_vazou from public.parametros;
  if v_vazou <> 0 then
    raise exception 'FALHOU: o lancador leu % linha(s) direto de parametros', v_vazou;
  end if;

  raise notice 'OK: o lancador le a identidade (9 chaves) e continua sem ler parametros';
end $$;

reset role;
rollback;
\echo 'TESTE DA IDENTIDADE: OK'
