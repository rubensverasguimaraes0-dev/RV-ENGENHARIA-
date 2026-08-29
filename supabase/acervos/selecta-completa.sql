-- =============================================================================
-- OBRA SELECTA - GIL MARTINS -- CARGA COMPLETA
--
-- Um arquivo so. Cole tudo no SQL Editor do Supabase e clique em Run.
-- O resultado certo e uma tabela com uma linha de numeros, no fim.
--
-- O QUE ENTRA NO APLICATIVO
--
--   Cliente Selecta e o pagador Romulo Veras
--   A obra, como empreitada de mao de obra, contrato de R$ 67.029,64
--   10 funcionarios, com entrada, saida e diaria de cada um
--   6 semanas ja fechadas, com os dias sem expediente marcados
--   82 presencas -- uma linha por funcionario por dia
--   31 dias de alimentacao, com o valor unitario praticado em cada dia
--   1 orcamento em 12 grupos + 1 grupo de terceirizados a cotar
--   13 parcelas -- 12 adiantamentos e o balao -- com 4 ja recebidas
--
-- OS NUMEROS QUE TEM DE SAIR NO FIM
--
--   presencas 82 | diarias 81,5 | mao de obra 12.855,00
--   quentinhas 79 | alimentacao 1.492,00 | custo total 14.347,00
--   contrato 67.029,64 | parcelas 13 | recebido 20.000,00
--   saldo 47.029,64 | quitado 29,8%
--
-- SEGURO DE RODAR DUAS VEZES: se a obra ja estiver no banco, o script para com
-- uma mensagem em vermelho e nao altera nada. Nada e duplicado.
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



do $$
declare
  v_obra      uuid;
  v_pagador   uuid;
  v_orcamento uuid;
begin

  -- ---------------------------------------------------------------------------
  -- Guardas
  -- ---------------------------------------------------------------------------
  select id into v_obra
    from public.obras
   where nome = 'Selecta - Gil Martins' and excluido_em is null;

  if v_obra is null then
    raise exception
      'A obra "Selecta - Gil Martins" nao esta no banco. Rode selecta-gil-martins.sql primeiro.';
  end if;

  if exists (select 1 from public.pagamentos
              where obra_id = v_obra and excluido_em is null) then
    raise exception
      'O cronograma desta obra ja foi carregado. Apague as parcelas antes de importar de novo.';
  end if;

  -- ---------------------------------------------------------------------------
  -- Quem paga. O local e a padaria Selecta; quem assina e paga e o Romulo Veras.
  -- O banco separa os dois de proposito (spec 4.1): dono do local e pagador nem
  -- sempre sao a mesma pessoa, e o comprovante sai no nome de quem pagou.
  -- ---------------------------------------------------------------------------
  select id into v_pagador
    from public.clientes where nome = 'Romulo Veras' and excluido_em is null limit 1;

  if v_pagador is null then
    insert into public.clientes (nome) values ('Romulo Veras') returning id into v_pagador;
  end if;

  -- ---------------------------------------------------------------------------
  -- O contrato. A obra entrou como diaria na primeira carga porque so se sabia
  -- do custo; o contrato com o cliente e empreitada de mao de obra, com preco
  -- fechado. Corrigir isso e o que faz a tela de Resultado ter sentido: de um
  -- lado R$ 67.029,64 de contrato, do outro o custo real das diarias.
  -- ---------------------------------------------------------------------------
  update public.obras set
    cliente_pagador_id = v_pagador,
    forma_contratacao  = 'empreitada',
    valor_contrato     = 6702964,
    tipo               = 'Reforma de padaria',
    observacoes        = 'Acervo importado da planilha de controle de diarias: 20/07/2026 a 28/08/2026. '
                      || 'Empreitada de mao de obra: material e alugueis por conta do contratante. '
                      || 'Outra unidade do mesmo cliente: Padaria Selecta Miguel Rosa (referencia de mobiliario).',
    atualizado_em      = now()
  where id = v_obra;

  -- ---------------------------------------------------------------------------
  -- Orcamento sintetico, no nivel de grupo. O detalhe item a item esta no PDF
  -- do orcamento; quando quiser subir, cada grupo vira fase 1.1, 1.2 e assim
  -- por diante, sem refazer nada do que esta aqui.
  --
  -- BDI zero e margem zero de proposito: os valores abaixo sao o preco fechado
  -- com o cliente, ja com tudo dentro. Inventar um BDI aqui mudaria o preco.
  -- ---------------------------------------------------------------------------
  insert into public.orcamentos
    (obra_id, cliente_id, numero, titulo, tipo, bdi, margem, modo_bdi,
     data, validade, total, condicoes_json, memorial)
  values
    (v_obra, v_pagador, '2026-001',
     'Reforma da Padaria Selecta - Gil Martins',
     'completo', 0, 0, 'embutido',
     '2026-07-17', '2026-08-16', 6702964,
     jsonb_build_object(
       'prazo', 'A definir com o contratante.',
       'forma_pagamento', '12 adiantamentos de R$ 5.000,00 aos sabados e 1 parcela final de R$ 7.029,64.',
       'garantia', 'Garantia dos servicos de mao de obra conforme o Codigo Civil.',
       'nao_incluso', 'Fornecimento de materiais e alugueis, taxas, licencas, ART/RRT, '
                   || 'descarte em aterro licenciado e equipamentos de acabamento nao citados.'),
     'Escopo: somente mao de obra. Composicoes com base em SINAPI, ORSE e composicoes proprias da RV.')
  returning id into v_orcamento;

  insert into public.itens_orcamento
    (orcamento_id, fase, descricao, unidade, quantidade, preco_unitario,
     base_referencia, terceirizado_sem_valor, ordem)
  values
    (v_orcamento,  '1', 'Demolicoes e retiradas',              'vb', 1,  388000, 'proprio', false,  1),
    (v_orcamento,  '2', 'Alvenaria de vedacao com estrutura',  'vb', 1,  445033, 'proprio', false,  2),
    (v_orcamento,  '3', 'Instalacao de bancadas',              'vb', 1,  160000, 'proprio', false,  3),
    (v_orcamento,  '4', 'Piso frente loja',                    'vb', 1,  320000, 'proprio', false,  4),
    (v_orcamento,  '5', 'Revestimentos',                       'vb', 1,  882420, 'proprio', false,  5),
    (v_orcamento,  '6', 'Pintura',                             'vb', 1,  762511, 'proprio', false,  6),
    (v_orcamento,  '7', 'Eletrica',                            'vb', 1, 2225000, 'proprio', false,  7),
    (v_orcamento,  '8', 'Sistema de internet e som',           'vb', 1,  350000, 'proprio', false,  8),
    (v_orcamento,  '9', 'Calcada',                             'vb', 1,  150000, 'proprio', false,  9),
    (v_orcamento, '10', 'Vigas metalicas',                     'vb', 1,  350000, 'proprio', false, 10),
    (v_orcamento, '11', 'Refrigeracao',                        'vb', 1,  120000, 'proprio', false, 11),
    (v_orcamento, '12', 'Banheiro interno',                    'vb', 1,  550000, 'proprio', false, 12),
    -- Terceirizados entram descritos e NAO somam: sao cotados a parte. E para
    -- isso que serve terceirizado_sem_valor -- some-los inflaria o contrato.
    (v_orcamento, '13', 'Terceirizados: forro drywall, marmoraria, ar-condicionado e metalurgia',
                                                               'vb', 1,    null, 'proprio', true,  13);

  -- ---------------------------------------------------------------------------
  -- Cronograma. Doze adiantamentos de R$ 5.000,00 e um balao com o saldo.
  --
  -- Vencimento e pagamento em campos separados: a parcela 3 venceu no sabado
  -- 08/08 e so caiu no domingo 09/08. Guardar so uma data apagaria o atraso.
  --
  -- A forma de pagamento fica em cada parcela, nunca na obra: houve Pix e pode
  -- haver especie na proxima.
  --
  -- O status na tela nao vem daqui -- o aplicativo calcula: quem tem
  -- recebimento esta paga, quem venceu sem receber esta atrasada.
  -- ---------------------------------------------------------------------------
  insert into public.pagamentos
    (obra_id, numero_parcela, valor_previsto, data_prevista,
     valor_recebido, data_recebimento, forma_pagamento, status, balao, observacao)
  values
    (v_obra,  1, 500000, '2026-07-23', 500000, '2026-07-23', 'Pix', 'paga',     false,
       'Primeira parcela, paga numa quinta-feira. Sem comprovante anexado.'),
    (v_obra,  2, 500000, '2026-08-01', 500000, '2026-08-01', 'Pix', 'paga',     false,
       'Comprovante IMG_2510.PNG: Bradesco para Nu Pagamentos, 01/08/2026 09h49, '
       || 'pagador R B Veras LTDA, no de controle 141.562.874.225.813.097.'),
    (v_obra,  3, 500000, '2026-08-08', 500000, '2026-08-09', 'Pix', 'paga',     false,
       'Venceu no sabado 08/08 e foi paga em 09/08. Comprovante IMG_2617.PNG: '
       || 'Nu Pagamentos para Banco do Brasil, 09/08/2026 18:48:15, pagador Armazem do Trigo, '
       || 'E18236120202608092148s095c104205.'),
    (v_obra,  4, 500000, '2026-08-15', 500000, '2026-08-15', 'Pix', 'paga',     false,
       'Comprovante IMG_2768.PNG: Nu Pagamentos para Banco C6, 15/08/2026 12:29:08, '
       || 'pagador Armazem do Trigo, E18236120202608151528s093417f016.'),
    (v_obra,  5, 500000, '2026-08-22', null, null, null, 'prevista', false, null),
    (v_obra,  6, 500000, '2026-08-29', null, null, null, 'prevista', false, null),
    (v_obra,  7, 500000, '2026-09-05', null, null, null, 'prevista', false, null),
    (v_obra,  8, 500000, '2026-09-12', null, null, null, 'prevista', false, null),
    (v_obra,  9, 500000, '2026-09-19', null, null, null, 'prevista', false, null),
    (v_obra, 10, 500000, '2026-09-26', null, null, null, 'prevista', false, null),
    (v_obra, 11, 500000, '2026-10-03', null, null, null, 'prevista', false, null),
    (v_obra, 12, 500000, '2026-10-10', null, null, null, 'prevista', false, null),
    (v_obra, 13, 702964, '2026-10-17', null, null, null, 'prevista', true,
       'Parcela balao: saldo remanescente do contrato. Se houver aditivo, o aplicativo '
       || 'recalcula este valor sozinho e os adiantamentos ficam como estao.');

  raise notice 'Contrato, orcamento e cronograma da Selecta - Gil Martins importados.';
end $$;



-- =============================================================================
-- CONFERENCIA -- a linha abaixo tem de bater com os numeros do cabecalho.
-- =============================================================================
with o as (
  select id, valor_contrato from public.obras
   where nome = 'Selecta - Gil Martins' and excluido_em is null
)
select
  (select count(*) from public.lancamentos_diarios l, o
    where l.obra_id = o.id and l.excluido_em is null)                        as presencas,
  (select sum(case when tipo_diaria = 'meia' then 0.5 else 1 end)
     from public.lancamentos_diarios l, o
    where l.obra_id = o.id and l.excluido_em is null)                        as diarias,
  (select sum(valor_diaria)/100.0 from public.lancamentos_diarios l, o
    where l.obra_id = o.id and l.excluido_em is null)                        as mao_de_obra,
  (select sum(quantidade) from public.quentinhas q, o
    where q.obra_id = o.id and q.excluido_em is null)                        as quentinhas,
  (select sum(quantidade * valor_unitario)/100.0 from public.quentinhas q, o
    where q.obra_id = o.id and q.excluido_em is null)                        as alimentacao,
  (select valor_contrato/100.0 from o)                                       as contrato,
  (select count(*) from public.pagamentos p, o
    where p.obra_id = o.id and p.excluido_em is null)                        as parcelas,
  (select coalesce(sum(valor_recebido),0)/100.0 from public.pagamentos p, o
    where p.obra_id = o.id and p.excluido_em is null)                        as recebido,
  (select (o.valor_contrato - coalesce((select sum(valor_recebido)
      from public.pagamentos p where p.obra_id = o.id and p.excluido_em is null),0))/100.0
     from o)                                                                 as saldo,
  (select round(100.0 * coalesce((select sum(valor_recebido) from public.pagamentos p
      where p.obra_id = o.id and p.excluido_em is null),0) / o.valor_contrato, 1)
     from o)                                                                 as pct_quitado;
