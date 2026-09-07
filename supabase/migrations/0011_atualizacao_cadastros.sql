-- =============================================================================
-- Atualizacao de cadastro a partir dos documentos de referencia (07/09/2026)
--
-- Fonte: os PDFs e os padroes que o Rubens entregou e que estao em
-- documentos/padrao/. Vale a versao mais recente de cada informacao.
--
-- Esta migracao so ACRESCENTA e CORRIGE. Nao apaga nada, nao cria a obra (ela
-- ja veio pelo acervo) e nao faz nada se a obra nao estiver no banco — assim
-- ela e segura num banco novo, vazio, onde a Selecta ainda nao existe.
-- =============================================================================

do $atualizacao$
declare
  v_obra_id    uuid;
  v_romulo_id  uuid;
begin

  -- ---------------------------------------------------------------------------
  -- 1. Clientes
  -- ---------------------------------------------------------------------------

  -- A padaria: endereco completo como sai nos documentos, e a razao social que
  -- aparece no comprovante do Pix, que nao e o nome pelo qual ela e conhecida.
  update public.clientes
     set endereco = 'Av. Gil Martins, 3144 (em frente ao Unipop) - Bairro Tres Andares - Teresina/PI',
         razao_social_comprovante = coalesce(razao_social_comprovante, 'Selecta Padaria')
   where nome = 'Selecta'
     and excluido_em is null;

  -- Quem assina e paga a obra.
  select id into v_romulo_id
    from public.clientes
   where nome = 'Romulo Veras' and excluido_em is null
   limit 1;

  if v_romulo_id is null then
    insert into public.clientes (nome, observacoes)
    values ('Romulo Veras', 'Cliente contratante da obra da Padaria Selecta.')
    returning id into v_romulo_id;
  end if;

  -- Cliente novo, da proposta de recuperacao de canaleta e reboco de parede.
  if not exists (
    select 1 from public.clientes
     where nome = 'Loja Revest - Marcenaria e Construcao' and excluido_em is null
  ) then
    insert into public.clientes (nome, telefone, endereco, observacoes)
    values (
      'Loja Revest - Marcenaria e Construcao',
      null,
      'Av. Dep. Paulo Ferraz, 1205 - Beira Rio - Teresina/PI - CEP 64045-840',
      'Contato: Danilo (Administrativo). Proposta de recuperacao de canaleta de '
        || 'escoamento e reboco de parede, 28,00 m de extensao.'
    );
  end if;

  -- ---------------------------------------------------------------------------
  -- 2. A obra
  -- ---------------------------------------------------------------------------

  select id into v_obra_id
    from public.obras
   where nome = 'Selecta - Gil Martins' and excluido_em is null
   limit 1;

  -- Banco sem a obra (instalacao nova): nada mais a fazer.
  if v_obra_id is null then
    raise notice 'Obra "Selecta - Gil Martins" nao esta neste banco; cadastros de cliente aplicados, o resto foi pulado.';
    return;
  end if;

  update public.obras
     set endereco = 'Av. Gil Martins, 3144 (em frente ao Unipop) - Bairro Tres Andares - Teresina/PI',
         cliente_pagador_id = coalesce(cliente_pagador_id, v_romulo_id)
   where id = v_obra_id;

  -- ---------------------------------------------------------------------------
  -- 3. Parcelas quitadas
  --
  -- O padrao (documentos/padrao/relatorios-de-cliente.md, secao 6) registra seis
  -- parcelas quitadas, R$ 30.000,00 no total, 44,8% da obra. O acervo tinha
  -- carregado quatro. Marca so o que falta, e nunca desmarca o que ja esta pago.
  -- ---------------------------------------------------------------------------

  update public.pagamentos p
     set status           = 'paga',
         valor_recebido   = coalesce(p.valor_recebido, p.valor_previsto),
         data_recebimento = coalesce(p.data_recebimento, novo.data_pagamento),
         forma_pagamento  = coalesce(p.forma_pagamento, 'Pix')
    from (values
      (1, date '2026-07-23'),
      (2, date '2026-08-01'),
      (3, date '2026-08-09'),
      (4, date '2026-08-15'),
      (5, date '2026-08-25'),
      (6, date '2026-08-30')
    ) as novo(numero, data_pagamento)
   where p.obra_id = v_obra_id
     and p.numero_parcela = novo.numero
     and p.excluido_em is null
     and p.status <> 'paga';

  -- ---------------------------------------------------------------------------
  -- 4. Notas da semana 7 (01/09 a 04/09), do Resumo_Despesas_Selecta_Semana7
  --
  -- Todas adiantadas pela RV — nenhuma foi paga pelo cliente na loja.
  -- ---------------------------------------------------------------------------

  insert into public.fornecedores (nome, categoria)
  select nome, 'material'
    from (values
      ('Baratao das Construcoes'),
      ('Comercial Barroso'),
      ('Kalfort Mat. Construcao')
    ) as f(nome)
   where not exists (
     select 1 from public.fornecedores x
      where x.nome = f.nome and x.excluido_em is null
   );

  insert into public.notas_fiscais
    (obra_id, data, fornecedor_id, fornecedor_nome, categoria, descricao, valor, pago_por, conferida)
  select
    v_obra_id,
    n.data,
    (select id from public.fornecedores x where x.nome = n.fornecedor and x.excluido_em is null limit 1),
    n.fornecedor,
    'material',
    n.descricao,
    n.valor,
    'rv',
    true
  from (values
    (date '2026-09-01', 'Baratao das Construcoes',
     'Material eletrico e esgoto (cabos, caixas, joelhos, fitas) - c/ desconto', 59850),
    (date '2026-09-02', 'Comercial Barroso',
     'Cabo flex Copperline 2,5 mm amarelo', 55680),
    (date '2026-09-02', 'Comercial Barroso',
     'Aditivo plastificante e fita isolante', 5184),
    (date '2026-09-04', 'Kalfort Mat. Construcao',
     'Tijolos (60 un)', 6000)
  ) as n(data, fornecedor, descricao, valor)
  where not exists (
    select 1 from public.notas_fiscais x
     where x.obra_id = v_obra_id
       and x.data = n.data
       and x.valor = n.valor
       and x.fornecedor_nome = n.fornecedor
       and x.excluido_em is null
  );

  raise notice 'Cadastros atualizados a partir dos documentos de referencia.';
end
$atualizacao$;
