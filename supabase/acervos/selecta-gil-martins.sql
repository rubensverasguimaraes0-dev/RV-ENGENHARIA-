-- =============================================================================
-- ACERVO DA OBRA SELECTA - GIL MARTINS  (20/07/2026 a 28/08/2026, semanas 1 a 6)
--
-- Gerado a partir da planilha Acervo_Obra_Selecta_Gil_Martins.xlsx.
-- Carrega no aplicativo, de uma vez, tudo o que ja foi lancado nesta obra:
--
--   1 cliente        Selecta
--   1 obra           Selecta - Gil Martins (padaria, Av. Gil Martins, 3144)
--  10 funcionarios   com entrada, saida e diaria de cada um
--   6 semanas        ja fechadas, com os dias sem expediente marcados
--  82 presencas      uma linha por funcionario por dia (a meia diaria do Iago inclusa)
--  31 dias de alimentacao  quentinhas, com o valor unitario praticado em cada dia
--
-- Confere com a planilha, linha a linha:
--   mao de obra    R$ 12.855,00
--   alimentacao    R$  1.492,00
--   total da obra  R$ 14.347,00
--   diarias        81,5
--   quentinhas     79 unidades
--
-- COMO USAR
--   Supabase -> SQL Editor -> New query -> colar tudo -> Run.
--   O resultado correto e "Success. No rows returned".
--   Rodar duas vezes nao duplica nada: o script para sozinho se a obra ja existir.
--
-- Valores em centavos, como o resto do aplicativo. Datas como texto aaaa-mm-dd.
-- =============================================================================

do $$
declare
  v_cliente uuid;
  v_obra    uuid;
  v_sem     uuid;
  v_func    uuid;
begin

  -- ---------------------------------------------------------------------------
  -- Guarda: se a obra ja estiver no banco, nao faz nada. Importar duas vezes
  -- dobraria o custo da obra sem nenhum aviso na tela.
  -- ---------------------------------------------------------------------------
  if exists (
    select 1 from public.obras
     where nome = 'Selecta - Gil Martins' and excluido_em is null
  ) then
    raise exception
      'A obra "Selecta - Gil Martins" ja existe. Apague-a antes de importar de novo.';
  end if;

  -- ---------------------------------------------------------------------------
  -- Cliente e obra
  -- ---------------------------------------------------------------------------
  select id into v_cliente
    from public.clientes where nome = 'Selecta' and excluido_em is null limit 1;

  if v_cliente is null then
    insert into public.clientes (nome, endereco)
    values ('Selecta', 'Av. Gil Martins, 3144 - Tres Andares - Teresina/PI')
    returning id into v_cliente;
  end if;

  insert into public.obras
    (cliente_id, nome, endereco, tipo, forma_contratacao, data_inicio, status, observacoes)
  values
    (v_cliente,
     'Selecta - Gil Martins',
     'Av. Gil Martins, 3144 - Tres Andares - Teresina/PI',
     'Padaria',
     'diaria',
     '2026-07-20',
     'em_andamento',
     'Acervo importado da planilha de controle de diarias: 20/07/2026 a 28/08/2026.')
  returning id into v_obra;


  -- ---------------------------------------------------------------------------
  -- Equipe. Funcionario ja cadastrado com o mesmo nome e reaproveitado --
  -- a mesma pessoa nao pode virar dois cadastros ao entrar noutra obra.
  -- ---------------------------------------------------------------------------

  select id into v_func from public.funcionarios
   where nome = 'Thiago' and excluido_em is null limit 1;
  if v_func is null then
    insert into public.funcionarios (nome, funcao, valor_diaria, data_entrada, data_saida, status)
    values ('Thiago', 'Pedreiro', 20000, '2026-07-20', null, 'ativo');
  end if;

  select id into v_func from public.funcionarios
   where nome = 'Wiliton' and excluido_em is null limit 1;
  if v_func is null then
    insert into public.funcionarios (nome, funcao, valor_diaria, data_entrada, data_saida, status)
    values ('Wiliton', 'Eletricista', 20000, '2026-07-23', null, 'ativo');
  end if;

  select id into v_func from public.funcionarios
   where nome = 'Gervasio' and excluido_em is null limit 1;
  if v_func is null then
    insert into public.funcionarios (nome, funcao, valor_diaria, data_entrada, data_saida, status)
    values ('Gervasio', 'Ajudante', 9000, '2026-07-20', '2026-07-29', 'desligado');
  end if;

  select id into v_func from public.funcionarios
   where nome = 'Máximo' and excluido_em is null limit 1;
  if v_func is null then
    insert into public.funcionarios (nome, funcao, valor_diaria, data_entrada, data_saida, status)
    values ('Máximo', 'Ajudante', 10000, '2026-07-25', null, 'ativo');
  end if;

  select id into v_func from public.funcionarios
   where nome = 'Amigo Máximo' and excluido_em is null limit 1;
  if v_func is null then
    insert into public.funcionarios (nome, funcao, valor_diaria, data_entrada, data_saida, status)
    values ('Amigo Máximo', 'Ajudante', 10000, '2026-07-25', null, 'ativo');
  end if;

  select id into v_func from public.funcionarios
   where nome = 'Wellington' and excluido_em is null limit 1;
  if v_func is null then
    insert into public.funcionarios (nome, funcao, valor_diaria, data_entrada, data_saida, status)
    values ('Wellington', 'Servente', 9000, '2026-07-28', '2026-08-03', 'desligado');
  end if;

  select id into v_func from public.funcionarios
   where nome = 'Roberto Júnior' and excluido_em is null limit 1;
  if v_func is null then
    insert into public.funcionarios (nome, funcao, valor_diaria, data_entrada, data_saida, status)
    values ('Roberto Júnior', 'Servente', 9000, '2026-07-28', '2026-08-03', 'desligado');
  end if;

  select id into v_func from public.funcionarios
   where nome = 'Eduardo' and excluido_em is null limit 1;
  if v_func is null then
    insert into public.funcionarios (nome, funcao, valor_diaria, data_entrada, data_saida, status)
    values ('Eduardo', 'Servente', 9000, '2026-07-29', '2026-08-07', 'desligado');
  end if;

  select id into v_func from public.funcionarios
   where nome = 'Rafael' and excluido_em is null limit 1;
  if v_func is null then
    insert into public.funcionarios (nome, funcao, valor_diaria, data_entrada, data_saida, status)
    values ('Rafael', 'Eletricista', 20000, '2026-08-11', null, 'ativo');
  end if;

  select id into v_func from public.funcionarios
   where nome = 'Iago' and excluido_em is null limit 1;
  if v_func is null then
    insert into public.funcionarios (nome, funcao, valor_diaria, data_entrada, data_saida, status)
    values ('Iago', 'Servente', 9000, '2026-08-12', null, 'ativo');
  end if;


  -- ---------------------------------------------------------------------------
  -- Semanas. A semana vai de segunda a sabado; o que nao foi trabalhado entra
  -- como dia sem expediente, para o relatorio da semana nao cobrar dia parado.
  -- Todas entram fechadas: sao semanas do passado, ja pagas.
  -- ---------------------------------------------------------------------------

  insert into public.semanas
    (obra_id, numero, data_inicio, data_fim, dias_sem_expediente_json, status, fechada_em)
  values (v_obra, 1, '2026-07-20', '2026-07-25', '[]'::jsonb, 'fechada', '2026-07-25 18:00-03');

  insert into public.semanas
    (obra_id, numero, data_inicio, data_fim, dias_sem_expediente_json, status, fechada_em)
  values (v_obra, 2, '2026-07-27', '2026-08-01', '["2026-08-01"]'::jsonb, 'fechada', '2026-08-01 18:00-03');

  insert into public.semanas
    (obra_id, numero, data_inicio, data_fim, dias_sem_expediente_json, status, fechada_em)
  values (v_obra, 3, '2026-08-03', '2026-08-08', '["2026-08-08"]'::jsonb, 'fechada', '2026-08-08 18:00-03');

  insert into public.semanas
    (obra_id, numero, data_inicio, data_fim, dias_sem_expediente_json, status, fechada_em)
  values (v_obra, 4, '2026-08-10', '2026-08-15', '["2026-08-15"]'::jsonb, 'fechada', '2026-08-15 18:00-03');

  insert into public.semanas
    (obra_id, numero, data_inicio, data_fim, dias_sem_expediente_json, status, fechada_em)
  values (v_obra, 5, '2026-08-17', '2026-08-22', '["2026-08-21", "2026-08-22"]'::jsonb, 'fechada', '2026-08-22 18:00-03');

  insert into public.semanas
    (obra_id, numero, data_inicio, data_fim, dias_sem_expediente_json, status, fechada_em)
  values (v_obra, 6, '2026-08-24', '2026-08-29', '["2026-08-29"]'::jsonb, 'fechada', '2026-08-29 18:00-03');


  -- ---------------------------------------------------------------------------
  -- Presencas: uma linha por funcionario por dia, com o valor congelado no dia.
  -- Mexer na diaria do cadastro daqui pra frente nao altera nada do que ja
  -- passou -- e por isso que o valor vai gravado aqui.
  -- ---------------------------------------------------------------------------

  select id into v_sem from public.semanas where obra_id = v_obra and numero = 1;
  insert into public.lancamentos_diarios
    (obra_id, semana_id, funcionario_id, data, tipo_diaria, valor_diaria)
  select v_obra, v_sem, f.id, v.data::date, v.tipo::public.tipo_diaria, v.valor
    from (values
           ('2026-07-20', 'Thiago', 'cheia', 20000),
           ('2026-07-20', 'Gervasio', 'cheia', 9000),
           ('2026-07-21', 'Thiago', 'cheia', 20000),
           ('2026-07-21', 'Gervasio', 'cheia', 9000),
           ('2026-07-22', 'Thiago', 'cheia', 20000),
           ('2026-07-22', 'Gervasio', 'cheia', 9000),
           ('2026-07-23', 'Thiago', 'cheia', 20000),
           ('2026-07-23', 'Wiliton', 'cheia', 20000),
           ('2026-07-23', 'Gervasio', 'cheia', 9000),
           ('2026-07-24', 'Thiago', 'cheia', 20000),
           ('2026-07-24', 'Wiliton', 'cheia', 20000),
           ('2026-07-24', 'Gervasio', 'cheia', 9000),
           ('2026-07-25', 'Thiago', 'cheia', 20000),
           ('2026-07-25', 'Gervasio', 'cheia', 9000),
           ('2026-07-25', 'Máximo', 'cheia', 10000),
           ('2026-07-25', 'Amigo Máximo', 'cheia', 10000)
         ) as v(data, nome, tipo, valor)
    join public.funcionarios f on f.nome = v.nome and f.excluido_em is null;

  select id into v_sem from public.semanas where obra_id = v_obra and numero = 2;
  insert into public.lancamentos_diarios
    (obra_id, semana_id, funcionario_id, data, tipo_diaria, valor_diaria)
  select v_obra, v_sem, f.id, v.data::date, v.tipo::public.tipo_diaria, v.valor
    from (values
           ('2026-07-27', 'Thiago', 'cheia', 20000),
           ('2026-07-27', 'Wiliton', 'cheia', 20000),
           ('2026-07-27', 'Gervasio', 'cheia', 9000),
           ('2026-07-28', 'Thiago', 'cheia', 20000),
           ('2026-07-28', 'Gervasio', 'cheia', 9000),
           ('2026-07-28', 'Wellington', 'cheia', 9000),
           ('2026-07-28', 'Roberto Júnior', 'cheia', 9000),
           ('2026-07-29', 'Thiago', 'cheia', 20000),
           ('2026-07-29', 'Wellington', 'cheia', 9000),
           ('2026-07-29', 'Roberto Júnior', 'cheia', 9000),
           ('2026-07-29', 'Eduardo', 'cheia', 9000),
           ('2026-07-30', 'Thiago', 'cheia', 20000),
           ('2026-07-30', 'Wellington', 'cheia', 9000),
           ('2026-07-30', 'Roberto Júnior', 'cheia', 9000),
           ('2026-07-30', 'Eduardo', 'cheia', 9000),
           ('2026-07-31', 'Thiago', 'cheia', 20000),
           ('2026-07-31', 'Wellington', 'cheia', 9000),
           ('2026-07-31', 'Roberto Júnior', 'cheia', 9000),
           ('2026-07-31', 'Eduardo', 'cheia', 9000)
         ) as v(data, nome, tipo, valor)
    join public.funcionarios f on f.nome = v.nome and f.excluido_em is null;

  select id into v_sem from public.semanas where obra_id = v_obra and numero = 3;
  insert into public.lancamentos_diarios
    (obra_id, semana_id, funcionario_id, data, tipo_diaria, valor_diaria)
  select v_obra, v_sem, f.id, v.data::date, v.tipo::public.tipo_diaria, v.valor
    from (values
           ('2026-08-03', 'Thiago', 'cheia', 20000),
           ('2026-08-03', 'Wiliton', 'cheia', 20000),
           ('2026-08-03', 'Eduardo', 'cheia', 9000),
           ('2026-08-04', 'Thiago', 'cheia', 20000),
           ('2026-08-04', 'Wiliton', 'cheia', 20000),
           ('2026-08-04', 'Eduardo', 'cheia', 9000),
           ('2026-08-05', 'Thiago', 'cheia', 20000),
           ('2026-08-05', 'Wiliton', 'cheia', 20000),
           ('2026-08-05', 'Eduardo', 'cheia', 9000),
           ('2026-08-06', 'Thiago', 'cheia', 20000),
           ('2026-08-06', 'Wiliton', 'cheia', 20000),
           ('2026-08-06', 'Eduardo', 'cheia', 9000),
           ('2026-08-07', 'Thiago', 'cheia', 20000),
           ('2026-08-07', 'Wiliton', 'cheia', 20000)
         ) as v(data, nome, tipo, valor)
    join public.funcionarios f on f.nome = v.nome and f.excluido_em is null;

  select id into v_sem from public.semanas where obra_id = v_obra and numero = 4;
  insert into public.lancamentos_diarios
    (obra_id, semana_id, funcionario_id, data, tipo_diaria, valor_diaria)
  select v_obra, v_sem, f.id, v.data::date, v.tipo::public.tipo_diaria, v.valor
    from (values
           ('2026-08-10', 'Thiago', 'cheia', 20000),
           ('2026-08-10', 'Wiliton', 'cheia', 20000),
           ('2026-08-11', 'Thiago', 'cheia', 20000),
           ('2026-08-11', 'Wiliton', 'cheia', 20000),
           ('2026-08-11', 'Rafael', 'cheia', 20000),
           ('2026-08-12', 'Thiago', 'cheia', 20000),
           ('2026-08-12', 'Iago', 'meia', 4500),
           ('2026-08-13', 'Thiago', 'cheia', 20000),
           ('2026-08-13', 'Iago', 'cheia', 9000),
           ('2026-08-14', 'Thiago', 'cheia', 20000),
           ('2026-08-14', 'Wiliton', 'cheia', 20000),
           ('2026-08-14', 'Iago', 'cheia', 9000)
         ) as v(data, nome, tipo, valor)
    join public.funcionarios f on f.nome = v.nome and f.excluido_em is null;

  select id into v_sem from public.semanas where obra_id = v_obra and numero = 5;
  insert into public.lancamentos_diarios
    (obra_id, semana_id, funcionario_id, data, tipo_diaria, valor_diaria)
  select v_obra, v_sem, f.id, v.data::date, v.tipo::public.tipo_diaria, v.valor
    from (values
           ('2026-08-17', 'Thiago', 'cheia', 20000),
           ('2026-08-17', 'Wiliton', 'cheia', 20000),
           ('2026-08-17', 'Iago', 'cheia', 9000),
           ('2026-08-18', 'Thiago', 'cheia', 20000),
           ('2026-08-18', 'Wiliton', 'cheia', 20000),
           ('2026-08-18', 'Iago', 'cheia', 9000),
           ('2026-08-19', 'Thiago', 'cheia', 20000),
           ('2026-08-19', 'Wiliton', 'cheia', 20000),
           ('2026-08-19', 'Iago', 'cheia', 9000),
           ('2026-08-20', 'Thiago', 'cheia', 20000),
           ('2026-08-20', 'Wiliton', 'cheia', 20000),
           ('2026-08-20', 'Iago', 'cheia', 9000)
         ) as v(data, nome, tipo, valor)
    join public.funcionarios f on f.nome = v.nome and f.excluido_em is null;

  select id into v_sem from public.semanas where obra_id = v_obra and numero = 6;
  insert into public.lancamentos_diarios
    (obra_id, semana_id, funcionario_id, data, tipo_diaria, valor_diaria)
  select v_obra, v_sem, f.id, v.data::date, v.tipo::public.tipo_diaria, v.valor
    from (values
           ('2026-08-24', 'Thiago', 'cheia', 20000),
           ('2026-08-25', 'Thiago', 'cheia', 20000),
           ('2026-08-25', 'Wiliton', 'cheia', 20000),
           ('2026-08-26', 'Thiago', 'cheia', 20000),
           ('2026-08-26', 'Wiliton', 'cheia', 20000),
           ('2026-08-27', 'Thiago', 'cheia', 20000),
           ('2026-08-27', 'Wiliton', 'cheia', 20000),
           ('2026-08-28', 'Thiago', 'cheia', 20000),
           ('2026-08-28', 'Wiliton', 'cheia', 20000)
         ) as v(data, nome, tipo, valor)
    join public.funcionarios f on f.nome = v.nome and f.excluido_em is null;


  -- ---------------------------------------------------------------------------
  -- Alimentacao. O valor unitario mudou tres vezes na obra (R$ 22,00 -> R$ 15,00
  -- -> R$ 18,00 -> R$ 22,00) e houve compra avulsa fora do fornecedor do mes,
  -- entao cada dia guarda o preco que foi pago naquele dia.
  --
  -- A observacao do dia -- entrada, desligamento, troca de fornecedor, semana
  -- encerrada mais cedo -- vem junto. O sabado 25/07 entra com quantidade zero
  -- so para nao perder o registro de que naquele dia nao houve quentinha.
  -- ---------------------------------------------------------------------------

  select id into v_sem from public.semanas where obra_id = v_obra and numero = 1;
  insert into public.quentinhas (obra_id, semana_id, data, quantidade, valor_unitario, observacao)
  values
    (v_obra, v_sem, '2026-07-20', 2, 2200, null),
    (v_obra, v_sem, '2026-07-21', 2, 2200, null),
    (v_obra, v_sem, '2026-07-22', 2, 2200, null),
    (v_obra, v_sem, '2026-07-23', 3, 2200, 'Entrada de Wiliton'),
    (v_obra, v_sem, '2026-07-24', 3, 2200, null),
    (v_obra, v_sem, '2026-07-25', 0, 0, 'Sábado até meio-dia: diária integral e sem quentinha. Entrada de Máximo e Amigo Máximo');

  select id into v_sem from public.semanas where obra_id = v_obra and numero = 2;
  insert into public.quentinhas (obra_id, semana_id, data, quantidade, valor_unitario, observacao)
  values
    (v_obra, v_sem, '2026-07-27', 3, 2200, null),
    (v_obra, v_sem, '2026-07-28', 4, 2200, 'Entrada de Wellington e Roberto Júnior'),
    (v_obra, v_sem, '2026-07-29', 4, 1500, 'Entrada de Eduardo. Desligamento de Gervasio. Troca de fornecedor: quentinha de R$ 22,00 para R$ 15,00'),
    (v_obra, v_sem, '2026-07-30', 4, 1500, null),
    (v_obra, v_sem, '2026-07-31', 4, 1500, 'Semana encerrada na sexta');

  select id into v_sem from public.semanas where obra_id = v_obra and numero = 3;
  insert into public.quentinhas (obra_id, semana_id, data, quantidade, valor_unitario, observacao)
  values
    (v_obra, v_sem, '2026-08-03', 3, 1500, 'Desligamento de Wellington e Roberto Júnior'),
    (v_obra, v_sem, '2026-08-04', 3, 2200, 'Compra avulsa a R$ 22,00'),
    (v_obra, v_sem, '2026-08-05', 3, 1500, null),
    (v_obra, v_sem, '2026-08-06', 3, 1800, 'Troca de fornecedor: quentinha passa a R$ 18,00'),
    (v_obra, v_sem, '2026-08-07', 2, 1800, 'Desligamento de Eduardo');

  select id into v_sem from public.semanas where obra_id = v_obra and numero = 4;
  insert into public.quentinhas (obra_id, semana_id, data, quantidade, valor_unitario, observacao)
  values
    (v_obra, v_sem, '2026-08-10', 2, 1800, null),
    (v_obra, v_sem, '2026-08-11', 4, 1800, 'Entrada de Rafael como reforço. 4 quentinhas para 3 funcionários (1 un. para o responsável)'),
    (v_obra, v_sem, '2026-08-12', 2, 1800, 'Entrada de Iago com meio expediente (meia diária)'),
    (v_obra, v_sem, '2026-08-13', 2, 1800, null),
    (v_obra, v_sem, '2026-08-14', 3, 2200, 'Compra avulsa a R$ 22,00 (fornecedor de R$ 18,00 indisponível)');

  select id into v_sem from public.semanas where obra_id = v_obra and numero = 5;
  insert into public.quentinhas (obra_id, semana_id, data, quantidade, valor_unitario, observacao)
  values
    (v_obra, v_sem, '2026-08-17', 3, 1800, null),
    (v_obra, v_sem, '2026-08-18', 3, 1800, null),
    (v_obra, v_sem, '2026-08-19', 3, 1800, null),
    (v_obra, v_sem, '2026-08-20', 3, 1800, 'Semana encerrada na quinta');

  select id into v_sem from public.semanas where obra_id = v_obra and numero = 6;
  insert into public.quentinhas (obra_id, semana_id, data, quantidade, valor_unitario, observacao)
  values
    (v_obra, v_sem, '2026-08-24', 1, 1800, 'Somente Thiago na obra'),
    (v_obra, v_sem, '2026-08-25', 2, 1800, null),
    (v_obra, v_sem, '2026-08-26', 2, 2200, 'Quentinha passa de R$ 18,00 para R$ 22,00'),
    (v_obra, v_sem, '2026-08-27', 2, 2200, null),
    (v_obra, v_sem, '2026-08-28', 2, 2200, 'Semana encerrada na sexta');


  raise notice 'Acervo da obra Selecta - Gil Martins importado.';
end $$;


-- =============================================================================
-- CONFERENCIA -- rode este bloco depois e compare com a planilha.
-- Tem de sair exatamente: 82 presencas, 81,5 diarias, R$ 12.855,00 de mao de
-- obra, 79 quentinhas, R$ 1.492,00 de alimentacao, R$ 14.347,00 no total.
-- =============================================================================
select
  (select count(*) from public.lancamentos_diarios l
    join public.obras o on o.id = l.obra_id
   where o.nome = 'Selecta - Gil Martins' and l.excluido_em is null)          as presencas,
  (select sum(case when tipo_diaria = 'meia' then 0.5 else 1 end)
     from public.lancamentos_diarios l join public.obras o on o.id = l.obra_id
    where o.nome = 'Selecta - Gil Martins' and l.excluido_em is null)         as diarias,
  (select sum(valor_diaria) / 100.0
     from public.lancamentos_diarios l join public.obras o on o.id = l.obra_id
    where o.nome = 'Selecta - Gil Martins' and l.excluido_em is null)         as mao_de_obra,
  (select sum(quantidade)
     from public.quentinhas q join public.obras o on o.id = q.obra_id
    where o.nome = 'Selecta - Gil Martins' and q.excluido_em is null)         as quentinhas,
  (select sum(quantidade * valor_unitario) / 100.0
     from public.quentinhas q join public.obras o on o.id = q.obra_id
    where o.nome = 'Selecta - Gil Martins' and q.excluido_em is null)         as alimentacao;
