-- =============================================================================
-- Parcela 7 da Selecta — paga em especie
--
-- A parcela que vencia em 05/09/2026 foi paga em especie. A data vem do recibo
-- que o Rubens emitiu (Cronograma_Selecta_Gil_Martins_com_comprovantes, pagina
-- 7): pagamento em 15/09/2026. Ele falou "ontem" na conversa, mas o recibo e o
-- documento, e o documento manda.
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
         data_recebimento = coalesce(data_recebimento, date '2026-09-15'),
         forma_pagamento  = coalesce(forma_pagamento, 'Espécie'),
         observacao       = coalesce(observacao, 'Pago em especie; recibo de recebimento emitido em 15/09/2026.')
   where obra_id = v_obra_id
     and numero_parcela = 7
     and excluido_em is null
     and status <> 'paga';
end
$parcela$;
