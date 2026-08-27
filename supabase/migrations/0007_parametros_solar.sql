-- =============================================================================
-- Parametros que a cotacao solar passou a usar (spec 5.5).
-- Regra 11.6: valor de referencia mora em parametros, nunca no codigo.
-- =============================================================================

insert into public.parametros (chave, valor, descricao) values
  ('solar_potencia_modulo_wp', '610',  'Potencia do modulo padrao, em Wp'),
  ('solar_area_modulo_m2',     '2.79', 'Area do modulo padrao, em m2'),
  ('solar_frete_percentual',   '0',    'Frete como fracao do custo quando nao ha valor informado')
on conflict (chave) do nothing;
