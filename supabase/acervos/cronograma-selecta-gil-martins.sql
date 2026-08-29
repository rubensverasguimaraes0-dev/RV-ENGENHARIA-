-- =============================================================================
-- SELECTA - GIL MARTINS: CONTRATO, ORCAMENTO E CRONOGRAMA DE PAGAMENTOS
--
-- Segunda parte do acervo da obra. A primeira (selecta-gil-martins.sql) trouxe
-- o custo: equipe, presencas e alimentacao. Esta traz a receita: o que foi
-- contratado com o cliente e como ele paga.
--
--   cliente pagador   Romulo Veras
--   regime            empreitada de mao de obra
--   contrato          R$ 67.029,64
--   orcamento         12 grupos de servico + 1 grupo de terceirizados a cotar
--   cronograma        12 adiantamentos de R$ 5.000,00 + balao de R$ 7.029,64
--   ja recebido       R$ 20.000,00 em 4 parcelas
--
-- ORDEM: rode selecta-gil-martins.sql ANTES deste. Este script depende da obra
-- ja existir e para com uma mensagem clara se ela nao existir.
--
-- COMO USAR
--   Supabase -> SQL Editor -> New query -> colar tudo -> Run.
--   O resultado correto e "Success. No rows returned".
--   Rodar duas vezes nao duplica: o script recusa se o cronograma ja existir.
--
-- Valores em centavos. Datas como texto aaaa-mm-dd.
-- =============================================================================

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
-- CONFERENCIA -- compare com o documento do cronograma.
-- Tem de sair: contrato 67029,64 | orcamento 67029,64 | 13 parcelas somando
-- 67029,64 | 4 quitadas somando 20000,00 | saldo 47029,64 | 29,8% quitado |
-- proximo vencimento 2026-08-22.
-- =============================================================================
select
  o.valor_contrato / 100.0                                        as contrato,
  (select total / 100.0 from public.orcamentos
    where obra_id = o.id and excluido_em is null)                 as orcamento,
  count(p.*)                                                      as parcelas,
  sum(p.valor_previsto) / 100.0                                   as soma_parcelas,
  count(*) filter (where p.valor_recebido is not null)            as quitadas,
  coalesce(sum(p.valor_recebido), 0) / 100.0                      as total_recebido,
  (o.valor_contrato - coalesce(sum(p.valor_recebido), 0)) / 100.0 as saldo,
  round(100.0 * coalesce(sum(p.valor_recebido), 0) / o.valor_contrato, 1) as pct_quitado,
  min(p.data_prevista) filter (where p.valor_recebido is null)    as proximo_vencimento
from public.obras o
join public.pagamentos p on p.obra_id = o.id and p.excluido_em is null
where o.nome = 'Selecta - Gil Martins' and o.excluido_em is null
group by o.id, o.valor_contrato;
