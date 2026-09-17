-- =============================================================================
-- Parcela 7 da Selecta — paga em especie
--
-- Informado pelo Rubens em 17/09/2026: a parcela que vencia em 05/09 foi paga
-- em especie no dia 16/09.
--
-- So marca se ainda nao estiver paga: se ele ja tiver registrado pelo proprio
-- aplicativo, esta migracao nao encosta na linha.
-- =============================================================================

do $parcela$
declare
  v_obra_id uuid;
begin
  select id into v_obra_id
    from public.obras
   where nome = 'Selecta - Gil Martins' and excluido_em is null
   limit 1;

  if v_obra_id is null then
    raise notice 'Obra "Selecta - Gil Martins" nao esta neste banco; nada a fazer.';
    return;
  end if;

  update public.pagamentos
     set status           = 'paga',
         valor_recebido   = coalesce(valor_recebido, valor_previsto),
         data_recebimento = coalesce(data_recebimento, date '2026-09-16'),
         forma_pagamento  = coalesce(forma_pagamento, 'Espécie')
   where obra_id = v_obra_id
     and numero_parcela = 7
     and excluido_em is null
     and status <> 'paga';
end
$parcela$;
