-- =============================================================================
-- RV ENGENHARIA — INSTALACAO COMPLETA DO BANCO
--
-- COMO USAR: cole este arquivo inteiro no SQL Editor do Supabase e clique em
-- RUN. Uma vez so. Ele cria tudo: tabelas, permissoes, parametros, buckets de
-- arquivos e a trigger que cria o perfil quando um usuario nasce no Auth.
--
-- Tudo roda dentro de uma transacao: ou instala inteiro, ou nao instala nada.
-- Se voce clicar em RUN duas vezes, ele avisa que ja esta instalado e nao
-- mexe em nada — nao ha risco de estragar o banco.
--
-- DEPOIS de rodar: crie seu usuario em Authentication > Users e execute
--   update public.usuarios set perfil = 'admin' where email = 'SEU@EMAIL.COM';
-- =============================================================================

begin;

-- Guarda: se o banco ja foi instalado, para aqui com uma mensagem legivel em
-- vez de um erro cripto de "type already exists".
do $verificacao$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'usuarios'
  ) then
    raise exception
      'O banco JA FOI INSTALADO — nao precisa rodar de novo. Nada foi alterado. (Para reinstalar do zero, apague o schema public antes.)';
  end if;
end
$verificacao$;


-- ###########################################################################
-- 0001_schema.sql
-- ###########################################################################

-- =============================================================================
-- RV Engenharia — esquema inicial (especificacao item 9)
--
-- Convencoes do banco:
--   * dinheiro e sempre BIGINT em CENTAVOS. Nunca float, nunca numeric solto:
--     o total de um relatorio de cliente nao pode depender de arredondamento.
--   * quantidades (m2, m linear, metragem de cabo) sao NUMERIC(14,4).
--   * datas de calendario sao DATE (sem fuso). Carimbos sao TIMESTAMPTZ.
--   * nada e apagado: exclusao e logica via excluido_em (spec 11.5).
-- =============================================================================

create extension if not exists "pgcrypto";

-- Marca de exclusao logica + carimbos, aplicada a toda tabela de dominio.
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Usuarios e permissoes (spec 2.1)
-- -----------------------------------------------------------------------------
create type public.perfil_usuario as enum ('admin', 'lancador');

create table public.usuarios (
  id            uuid primary key references auth.users (id) on delete cascade,
  nome          text not null,
  email         text not null unique,
  perfil        public.perfil_usuario not null default 'lancador',
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);

-- -----------------------------------------------------------------------------
-- Clientes (spec 4.1)
-- -----------------------------------------------------------------------------
create table public.clientes (
  id                        uuid primary key default gen_random_uuid(),
  nome                      text not null,
  -- razao social que aparece no comprovante de pagamento, nem sempre igual ao
  -- nome pelo qual o cliente e conhecido
  razao_social_comprovante  text,
  documento                 text,
  telefone                  text,
  email                     text,
  endereco                  text,
  -- agrupamento de unidades/CNPJs do mesmo grupo (ex.: 4 padarias + 1 hortifruti)
  cliente_pai_id            uuid references public.clientes (id),
  observacoes               text,
  criado_em                 timestamptz not null default now(),
  atualizado_em             timestamptz not null default now(),
  excluido_em               timestamptz
);
create index on public.clientes (cliente_pai_id);

-- -----------------------------------------------------------------------------
-- Obras e locais (spec 4.2)
-- -----------------------------------------------------------------------------
create type public.forma_contratacao as enum ('diaria', 'empreitada', 'medicao', 'unidade');
create type public.status_obra as enum ('orcada', 'em_andamento', 'paralisada', 'concluida');
create type public.base_rateio_parceiro as enum ('resultado_total', 'margem_mao_obra');

create table public.obras (
  id                          uuid primary key default gen_random_uuid(),
  cliente_id                  uuid not null references public.clientes (id),
  -- quem paga pode ser diferente do dono do local (spec 4.1)
  cliente_pagador_id          uuid references public.clientes (id),
  nome                        text not null,
  endereco                    text,
  tipo                        text,
  forma_contratacao           public.forma_contratacao not null default 'diaria',
  data_inicio                 date,
  data_prevista_fim           date,
  status                      public.status_obra not null default 'em_andamento',
  valor_contrato              bigint not null default 0,
  percentual_rateio_parceiro  numeric(5,4) not null default 0.5000,
  base_rateio_parceiro        public.base_rateio_parceiro not null default 'resultado_total',
  observacoes                 text,
  criado_em                   timestamptz not null default now(),
  atualizado_em               timestamptz not null default now(),
  excluido_em                 timestamptz
);
create index on public.obras (cliente_id);
create index on public.obras (status);

create table public.locais_obra (
  id            uuid primary key default gen_random_uuid(),
  obra_id       uuid not null references public.obras (id) on delete cascade,
  nome          text not null,
  endereco      text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);
create index on public.locais_obra (obra_id);

-- Vinculo do lancador com as obras que ele pode lancar (spec 2.1)
create table public.usuarios_obras (
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  obra_id    uuid not null references public.obras (id) on delete cascade,
  criado_em  timestamptz not null default now(),
  primary key (usuario_id, obra_id)
);

-- -----------------------------------------------------------------------------
-- Funcionarios e parceiros (spec 4.3)
-- -----------------------------------------------------------------------------
create type public.tipo_pessoa as enum ('funcionario', 'parceiro');
create type public.status_funcionario as enum ('ativo', 'desligado', 'alocado');

create table public.funcionarios (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  tipo          public.tipo_pessoa not null default 'funcionario',
  funcao        text,
  -- vale do dia do lancamento para frente; o lancamento congela o valor aplicado
  valor_diaria  bigint not null default 0,
  telefone      text,
  chave_pix     text,
  status        public.status_funcionario not null default 'ativo',
  data_entrada  date,
  data_saida    date,
  observacoes   text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);
create index on public.funcionarios (status);

-- -----------------------------------------------------------------------------
-- Semanas, lancamento diario e quentinhas (spec 4.4 e 4.5)
-- -----------------------------------------------------------------------------
create type public.status_semana as enum ('aberta', 'fechada');
create type public.tipo_diaria as enum ('cheia', 'meia', 'sem_diaria');

create table public.semanas (
  id                       uuid primary key default gen_random_uuid(),
  obra_id                  uuid not null references public.obras (id) on delete cascade,
  numero                   integer not null,
  data_inicio              date not null,          -- segunda-feira
  data_fim                 date not null,          -- sabado
  -- dias marcados como sem expediente nao entram no relatorio da semana
  dias_sem_expediente_json jsonb not null default '[]'::jsonb,
  status                   public.status_semana not null default 'aberta',
  fechada_em               timestamptz,
  criado_em                timestamptz not null default now(),
  atualizado_em            timestamptz not null default now(),
  excluido_em              timestamptz,
  unique (obra_id, numero),
  unique (obra_id, data_inicio)
);

create table public.lancamentos_diarios (
  id             uuid primary key default gen_random_uuid(),
  obra_id        uuid not null references public.obras (id) on delete cascade,
  semana_id      uuid references public.semanas (id) on delete set null,
  funcionario_id uuid not null references public.funcionarios (id),
  data           date not null,
  tipo_diaria    public.tipo_diaria not null default 'cheia',
  -- valor aplicado no dia, congelado: alterar a diaria do cadastro nao muda o passado
  valor_diaria   bigint not null default 0,
  valor_vale     bigint not null default 0,
  observacao     text,
  criado_por     uuid references public.usuarios (id),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  excluido_em    timestamptz
);
-- bloqueia dois lancamentos do mesmo funcionario, na mesma obra, na mesma data
create unique index lancamentos_unicos_por_dia
  on public.lancamentos_diarios (obra_id, funcionario_id, data)
  where excluido_em is null;
create index on public.lancamentos_diarios (semana_id);
create index on public.lancamentos_diarios (obra_id, data);

create table public.quentinhas (
  id             uuid primary key default gen_random_uuid(),
  obra_id        uuid not null references public.obras (id) on delete cascade,
  semana_id      uuid references public.semanas (id) on delete set null,
  data           date not null,
  -- pode nao bater com o numero de presentes (spec 4.4)
  quantidade     integer not null default 0,
  valor_unitario bigint not null default 0,
  observacao     text,
  criado_por     uuid references public.usuarios (id),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  excluido_em    timestamptz
);
create index on public.quentinhas (obra_id, data);
create index on public.quentinhas (semana_id);

-- -----------------------------------------------------------------------------
-- Fornecedores, notas fiscais e despesas (spec 4.6)
-- -----------------------------------------------------------------------------
create table public.fornecedores (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  contato             text,
  categoria           text,
  condicao_pagamento  text,
  ativo               boolean not null default true,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  excluido_em         timestamptz
);

create type public.categoria_nota as enum
  ('material', 'locacao', 'cacamba', 'terceiro', 'combustivel', 'outro');
create type public.pago_por as enum ('rv', 'cliente');

create table public.notas_fiscais (
  id                uuid primary key default gen_random_uuid(),
  obra_id           uuid references public.obras (id) on delete cascade,
  local_id          uuid references public.locais_obra (id),
  semana_id         uuid references public.semanas (id) on delete set null,
  data              date not null,
  fornecedor_id     uuid references public.fornecedores (id),
  fornecedor_nome   text,                       -- digitado quando ainda nao cadastrado
  numero_nota       text,
  categoria         public.categoria_nota not null default 'material',
  descricao         text,
  valor             bigint not null default 0,
  forma_pagamento   text,
  -- nota paga pelo cliente na loja nao integra o valor a repassar (spec 4.6)
  pago_por          public.pago_por not null default 'rv',
  conferida         boolean not null default false,
  repassada_em      date,
  -- anotacao interna ("de qual cliente e esta nota") — nunca sai em documento
  anotacao_interna  text,
  a_confirmar       boolean not null default false,
  criado_por        uuid references public.usuarios (id),
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  excluido_em       timestamptz
);
create index on public.notas_fiscais (obra_id, data);
create index on public.notas_fiscais (semana_id);
create index on public.notas_fiscais (a_confirmar) where a_confirmar;

-- nota dividida entre locais/obras (spec 4.6)
create table public.rateio_nota (
  id            uuid primary key default gen_random_uuid(),
  nota_id       uuid not null references public.notas_fiscais (id) on delete cascade,
  local_id      uuid references public.locais_obra (id),
  obra_id       uuid references public.obras (id),
  valor         bigint not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);
create index on public.rateio_nota (nota_id);

-- varias fotos por nota (cupons longos)
create table public.fotos_nota (
  id          uuid primary key default gen_random_uuid(),
  nota_id     uuid not null references public.notas_fiscais (id) on delete cascade,
  arquivo_url text not null,
  ordem       integer not null default 0,
  criado_em   timestamptz not null default now(),
  excluido_em timestamptz
);
create index on public.fotos_nota (nota_id, ordem);

create table public.despesas_sem_nota (
  id                uuid primary key default gen_random_uuid(),
  obra_id           uuid not null references public.obras (id) on delete cascade,
  local_id          uuid references public.locais_obra (id),
  semana_id         uuid references public.semanas (id) on delete set null,
  data              date not null,
  descricao         text not null,
  categoria         public.categoria_nota not null default 'outro',
  valor             bigint not null default 0,
  pago_a            text,
  -- entra no custo da obra e nunca no repasse, salvo marcacao explicita
  repassar_cliente  boolean not null default false,
  criado_por        uuid references public.usuarios (id),
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  excluido_em       timestamptz
);
create index on public.despesas_sem_nota (obra_id, data);

-- -----------------------------------------------------------------------------
-- Cronograma de pagamentos (spec 4.9)
-- -----------------------------------------------------------------------------
create type public.status_parcela as enum ('prevista', 'paga', 'atrasada');

create table public.pagamentos (
  id                    uuid primary key default gen_random_uuid(),
  obra_id               uuid not null references public.obras (id) on delete cascade,
  numero_parcela        integer not null,
  valor_previsto        bigint not null default 0,
  data_prevista         date,
  valor_recebido        bigint,
  data_recebimento      date,
  forma_pagamento       text,                    -- varia a cada parcela
  comprovante_url       text,
  -- parte do comprovante que pertence a outro contrato (spec 4.9)
  valor_outro_contrato  bigint not null default 0,
  observacao            text,
  status                public.status_parcela not null default 'prevista',
  balao                 boolean not null default false,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  excluido_em           timestamptz
);
create index on public.pagamentos (obra_id, numero_parcela);

-- -----------------------------------------------------------------------------
-- Almoxarifado (spec 4.10)
-- -----------------------------------------------------------------------------
create table public.almoxarifado_itens (
  id             uuid primary key default gen_random_uuid(),
  obra_id        uuid not null references public.obras (id) on delete cascade,
  categoria      text not null,                  -- eletrica, hidraulica, alvenaria e piso...
  descricao      text not null,                  -- grafia em caixa alta
  unidade        text,
  quantidade     numeric(14,4),                  -- pode ficar sem quantidade definida
  cor_bitola     text,                           -- cabos: cor e bitola
  metragem       numeric(14,4),                  -- cabo por pedaco
  custo_unitario bigint,                         -- nunca aparece em documento do cliente
  valor_cobranca bigint,                         -- valor cobrado do cliente
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  excluido_em    timestamptz
);
create index on public.almoxarifado_itens (obra_id, categoria);

create table public.almoxarifado_saidas (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null references public.almoxarifado_itens (id) on delete cascade,
  data           date not null,
  quantidade     numeric(14,4) not null default 0,
  quem_pegou     text,
  onde_usou      text,
  cobrar_cliente boolean not null default false,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  excluido_em    timestamptz
);
create index on public.almoxarifado_saidas (item_id, data);

-- -----------------------------------------------------------------------------
-- Servicos, medicoes e terceiros (spec 4.11 e 4.12)
-- -----------------------------------------------------------------------------
create table public.servicos_executados (
  id                   uuid primary key default gen_random_uuid(),
  obra_id              uuid not null references public.obras (id) on delete cascade,
  local_id             uuid references public.locais_obra (id),
  grupo                text,                     -- obras civis, eletrica, pintura...
  descricao            text not null,
  valor                bigint not null default 0,
  executado            boolean not null default true,
  valor_deducao        bigint not null default 0,
  justificativa_deducao text,
  ordem                integer not null default 0,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  excluido_em          timestamptz
);
create index on public.servicos_executados (obra_id);

create table public.servicos_medicao (
  id                    uuid primary key default gen_random_uuid(),
  obra_id               uuid not null references public.obras (id) on delete cascade,
  descricao             text not null,
  unidade               text not null,           -- m2, m linear, unidade
  quantidade_contratada numeric(14,4),
  custo_unitario        bigint,                  -- interno
  preco_venda_unitario  bigint not null default 0,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  excluido_em           timestamptz
);
create index on public.servicos_medicao (obra_id);

create table public.medicoes (
  id            uuid primary key default gen_random_uuid(),
  obra_id       uuid not null references public.obras (id) on delete cascade,
  servico_id    uuid not null references public.servicos_medicao (id) on delete cascade,
  local_id      uuid references public.locais_obra (id),
  data          date not null,
  quantidade    numeric(14,4) not null default 0,
  observacao    text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);
create index on public.medicoes (servico_id, data);

create table public.terceiros (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  atividade     text,
  contato       text,
  forma_cobranca text,                           -- por m2, por unidade, global
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);

create table public.servicos_terceiros (
  id              uuid primary key default gen_random_uuid(),
  obra_id         uuid not null references public.obras (id) on delete cascade,
  terceiro_id     uuid not null references public.terceiros (id),
  descricao       text,
  quantidade      numeric(14,4),
  valor_combinado bigint not null default 0,
  valor_pago      bigint not null default 0,
  comprovante_url text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  excluido_em     timestamptz
);
create index on public.servicos_terceiros (obra_id);

-- -----------------------------------------------------------------------------
-- Orcamentos (spec 4.13)
-- -----------------------------------------------------------------------------
create type public.modo_bdi as enum ('visivel', 'embutido', 'sem_bdi');
create type public.tipo_orcamento as enum ('rapido', 'completo');
create type public.base_referencia as enum ('SINAPI', 'ORSE', 'SICRO', 'proprio');

create table public.orcamentos (
  id                  uuid primary key default gen_random_uuid(),
  obra_id             uuid references public.obras (id) on delete set null,
  cliente_id          uuid references public.clientes (id),
  numero              text,
  titulo              text,
  tipo                public.tipo_orcamento not null default 'rapido',
  bdi                 numeric(5,4) not null default 0,
  modo_bdi            public.modo_bdi not null default 'embutido',
  data                date not null default current_date,
  validade            date,
  condicoes_json      jsonb not null default '{}'::jsonb,
  versao_exibicao_json jsonb not null default '{}'::jsonb,
  total               bigint not null default 0,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  excluido_em         timestamptz
);
create index on public.orcamentos (obra_id);

create table public.itens_orcamento (
  id                     uuid primary key default gen_random_uuid(),
  orcamento_id           uuid not null references public.orcamentos (id) on delete cascade,
  fase                   text,                   -- 1, 1.1, 1.1.1
  codigo_referencia      text,
  base_referencia        public.base_referencia not null default 'proprio',
  descricao              text not null,
  unidade                text,
  quantidade             numeric(14,4),
  custo_material         bigint,                 -- interno
  custo_mao_obra         bigint,                 -- interno
  preco_unitario         bigint,
  -- item "a cotar separadamente": aparece descrito, sem preco, e nao soma
  terceirizado_sem_valor boolean not null default false,
  ordem                  integer not null default 0,
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now(),
  excluido_em            timestamptz
);
create index on public.itens_orcamento (orcamento_id, ordem);

-- -----------------------------------------------------------------------------
-- Cotacoes de fornecedor — base compartilhada obras civis + solar (spec 6.1)
-- -----------------------------------------------------------------------------
create table public.cotacoes (
  id                 uuid primary key default gen_random_uuid(),
  fornecedor_id      uuid not null references public.fornecedores (id),
  numero_documento   text,
  data               date not null default current_date,
  vendedor           text,
  validade           date,
  condicao_pagamento text,
  total              bigint not null default 0,
  base               boolean not null default false,   -- cotacao marcada como base
  arquivo_url        text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  excluido_em        timestamptz
);
create index on public.cotacoes (fornecedor_id, data);

create table public.itens_cotacao (
  id             uuid primary key default gen_random_uuid(),
  cotacao_id     uuid not null references public.cotacoes (id) on delete cascade,
  categoria      text,
  marca          text,
  modelo         text,
  especificacao  text,                            -- Wp, kW, bitola
  unidade        text,
  quantidade     numeric(14,4),
  preco_unitario bigint not null default 0,
  estimado       boolean not null default false,  -- item que faltou na cotacao
  substituido    boolean not null default false,  -- fornecedor trocou por equivalente
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  excluido_em    timestamptz
);
create index on public.itens_cotacao (cotacao_id);
create index on public.itens_cotacao (categoria);

-- -----------------------------------------------------------------------------
-- Energia solar (spec 5)
-- -----------------------------------------------------------------------------
create type public.tipo_ligacao as enum ('monofasica', 'bifasica', 'trifasica');

create table public.projetos_solar (
  id                 uuid primary key default gen_random_uuid(),
  cliente_id         uuid not null references public.clientes (id),
  uc                 text,
  concessionaria     text default 'Equatorial Piaui',
  tipo_ligacao       public.tipo_ligacao not null default 'monofasica',
  tarifa             bigint not null default 0,         -- centavos por kWh
  consumo_mensal_json jsonb not null default '[]'::jsonb,
  tipo_telhado       text,
  distancia_quadro   numeric(10,2),
  anexo_conta_url    text,
  potencia_kwp       numeric(10,3),
  qtd_modulos        integer,
  modelo_modulo      text,
  modelo_inversor    text,
  geracao_estimada   numeric(12,2),
  custo_total        bigint,
  margem             numeric(5,4),
  preco_venda        bigint,
  status             text not null default 'rascunho',
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  excluido_em        timestamptz
);
create index on public.projetos_solar (cliente_id);

create table public.itens_projeto_solar (
  id               uuid primary key default gen_random_uuid(),
  projeto_id       uuid not null references public.projetos_solar (id) on delete cascade,
  item_cotacao_id  uuid references public.itens_cotacao (id),
  descricao        text not null,
  quantidade       numeric(14,4) not null default 0,
  preco_unitario   bigint not null default 0,
  total            bigint not null default 0,
  ordem            integer not null default 0,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  excluido_em      timestamptz
);
create index on public.itens_projeto_solar (projeto_id, ordem);

-- -----------------------------------------------------------------------------
-- Locacao de equipamentos (spec 7)
-- -----------------------------------------------------------------------------
create type public.status_equipamento as enum ('disponivel', 'locado', 'manutencao');
create type public.status_contrato_locacao as enum ('aberto', 'devolvido', 'atrasado', 'cancelado');

create table public.equipamentos (
  id            uuid primary key default gen_random_uuid(),
  descricao     text not null,
  categoria     text,
  patrimonio    text,
  quantidade_estoque integer not null default 1,
  valor_compra  bigint,
  status        public.status_equipamento not null default 'disponivel',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);

create table public.tabela_locacao (
  id              uuid primary key default gen_random_uuid(),
  equipamento_id  uuid not null references public.equipamentos (id) on delete cascade,
  valor_diaria    bigint not null default 0,
  valor_semana    bigint not null default 0,
  valor_mes       bigint not null default 0,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  excluido_em     timestamptz
);
create index on public.tabela_locacao (equipamento_id);

create table public.contratos_locacao (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid references public.clientes (id),
  -- equipamento proprio alocado a uma obra da RV: custo interno, sem receita
  obra_id         uuid references public.obras (id),
  uso_interno     boolean not null default false,
  data_saida      date not null,
  data_prevista   date,
  data_devolucao  date,
  valor           bigint not null default 0,
  caucao          bigint not null default 0,
  forma_pagamento text,
  observacao      text,
  status          public.status_contrato_locacao not null default 'aberto',
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  excluido_em     timestamptz
);
create index on public.contratos_locacao (cliente_id);
create index on public.contratos_locacao (status);

create table public.itens_contrato_locacao (
  id             uuid primary key default gen_random_uuid(),
  contrato_id    uuid not null references public.contratos_locacao (id) on delete cascade,
  equipamento_id uuid not null references public.equipamentos (id),
  quantidade     integer not null default 1,
  valor          bigint not null default 0,
  estado_devolucao text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  excluido_em    timestamptz
);
create index on public.itens_contrato_locacao (contrato_id);

-- -----------------------------------------------------------------------------
-- Arquivos recebidos e documentos gerados (spec 4.16 e 4.17)
-- -----------------------------------------------------------------------------
create table public.arquivos (
  id            uuid primary key default gen_random_uuid(),
  obra_id       uuid references public.obras (id) on delete cascade,
  cliente_id    uuid references public.clientes (id) on delete cascade,
  tipo          text,          -- projeto, contrato, cartao CNPJ, conta de energia, foto
  descricao     text,
  data          date default current_date,
  arquivo_url   text not null,
  galeria       boolean not null default false,   -- foto da obra
  momento       text,                             -- antes | depois
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);
create index on public.arquivos (obra_id);
create index on public.arquivos (cliente_id);

create table public.documentos (
  id                   uuid primary key default gen_random_uuid(),
  obra_id              uuid references public.obras (id) on delete cascade,
  tipo                 text not null,    -- fechamento_semanal, relatorio_despesas...
  referencia           text,             -- ex.: "Semana 3"
  versao_exibicao_json jsonb not null default '{}'::jsonb,
  arquivo_url          text,
  gerado_por           uuid references public.usuarios (id),
  gerado_em            timestamptz not null default now(),
  excluido_em          timestamptz
);
create index on public.documentos (obra_id, gerado_em desc);

-- -----------------------------------------------------------------------------
-- Parametros (spec 8 e 11.6): nenhum valor de referencia fica fixo no codigo
-- -----------------------------------------------------------------------------
create table public.parametros (
  chave         text primary key,
  valor         text not null,
  descricao     text,
  atualizado_em timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Trigger de atualizado_em em todas as tabelas que tem a coluna
-- -----------------------------------------------------------------------------
do $$
declare t record;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'atualizado_em'
  loop
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.tocar_atualizado_em()',
      't_atualizado_em_' || t.table_name, t.table_name);
  end loop;
end $$;


-- ###########################################################################
-- 0002_rls.sql
-- ###########################################################################

-- =============================================================================
-- RV Engenharia — perfis e seguranca em nivel de linha (especificacao 2.1)
--
-- "Toda tela de valor sensivel (custo, margem, BDI, resultado) e bloqueada por
--  perfil, nao apenas escondida no front."
--
-- Como isso e garantido aqui:
--   * o lancador nao tem SELECT nas tabelas que carregam valor de contrato,
--     custo, orcamento ou resultado — nem via API, nem via SQL;
--   * o que ele precisa ver (nome da obra, lista de quem esta ativo) chega por
--     views que expoem apenas as colunas seguras;
--   * o valor da diaria nunca trafega pelo cliente do lancador: ele e resolvido
--     no servidor pela funcao registrar_presenca.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funcoes de apoio. SECURITY DEFINER para poderem ler public.usuarios sem cair
-- na propria RLS (e sem recursao de politica).
-- -----------------------------------------------------------------------------
create or replace function public.perfil_atual()
returns public.perfil_usuario
language sql
stable
security definer
set search_path = public
as $$
  select u.perfil
  from public.usuarios u
  where u.id = auth.uid() and u.ativo and u.excluido_em is null
$$;

create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.perfil_atual() = 'admin', false)
$$;

-- Admin acessa qualquer obra; lancador, apenas as obras a que esta vinculado.
create or replace function public.tem_acesso_obra(p_obra_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.eh_admin()
     or exists (
          select 1 from public.usuarios_obras uo
          where uo.usuario_id = auth.uid() and uo.obra_id = p_obra_id
        )
$$;

-- -----------------------------------------------------------------------------
-- RLS ligada em todas as tabelas do schema public.
-- Sem policy = ninguem le. As permissoes sao concedidas explicitamente abaixo.
-- -----------------------------------------------------------------------------
-- Nao se usa FORCE ROW LEVEL SECURITY aqui de proposito: o dono das tabelas e
-- o mesmo papel que cria as views seguras abaixo, e essas views precisam ler a
-- tabela base para devolver ao lancador apenas as colunas permitidas. O app
-- nunca se conecta como dono — o PostgREST usa 'authenticated', que e filtrado
-- normalmente pelas policies.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- Privilegios de tabela (o mesmo que o Supabase concede por padrao). Quem
-- decide o que cada perfil ve sao as policies; estes grants apenas garantem que
-- o comportamento nao dependa do padrao do projeto.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- Tabelas exclusivas do admin: contrato, custo, margem, orcamento, resultado,
-- cadastros e tudo o que o lancador nao pode ver.
do $$
declare t text;
begin
  foreach t in array array[
    'clientes', 'obras', 'locais_obra', 'funcionarios', 'usuarios_obras',
    'fornecedores', 'despesas_sem_nota', 'pagamentos',
    'almoxarifado_itens', 'almoxarifado_saidas',
    'servicos_executados', 'servicos_medicao', 'medicoes',
    'terceiros', 'servicos_terceiros',
    'orcamentos', 'itens_orcamento', 'cotacoes', 'itens_cotacao',
    'projetos_solar', 'itens_projeto_solar',
    'equipamentos', 'tabela_locacao', 'contratos_locacao', 'itens_contrato_locacao',
    'arquivos', 'documentos', 'parametros', 'rateio_nota'
  ]
  loop
    execute format($f$
      create policy admin_total on public.%I
        for all to authenticated
        using (public.eh_admin())
        with check (public.eh_admin())
    $f$, t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- usuarios: cada um le a propria linha; o admin gerencia todas.
-- -----------------------------------------------------------------------------
create policy usuario_le_proprio on public.usuarios
  for select to authenticated
  using (id = auth.uid() or public.eh_admin());

create policy admin_gerencia_usuarios on public.usuarios
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- -----------------------------------------------------------------------------
-- Semanas: o lancador le as semanas das suas obras (precisa saber a semana
-- corrente), mas nao fecha semana — fechar e do admin.
-- -----------------------------------------------------------------------------
create policy semanas_leitura on public.semanas
  for select to authenticated
  using (public.tem_acesso_obra(obra_id));

create policy semanas_admin on public.semanas
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- -----------------------------------------------------------------------------
-- Lancamento diario e quentinhas: o lancador lanca nas obras a que esta
-- vinculado. Nao pode mexer em semana ja fechada.
-- -----------------------------------------------------------------------------
create policy lancamentos_leitura on public.lancamentos_diarios
  for select to authenticated
  using (public.tem_acesso_obra(obra_id));

create policy lancamentos_insere on public.lancamentos_diarios
  for insert to authenticated
  with check (
    public.tem_acesso_obra(obra_id)
    and not exists (
      select 1 from public.semanas s
      where s.id = semana_id and s.status = 'fechada'
    )
  );

create policy lancamentos_edita on public.lancamentos_diarios
  for update to authenticated
  using (
    public.tem_acesso_obra(obra_id)
    and (public.eh_admin() or not exists (
      select 1 from public.semanas s where s.id = semana_id and s.status = 'fechada'
    ))
  )
  with check (public.tem_acesso_obra(obra_id));

create policy lancamentos_admin_apaga on public.lancamentos_diarios
  for delete to authenticated
  using (public.eh_admin());

create policy quentinhas_leitura on public.quentinhas
  for select to authenticated
  using (public.tem_acesso_obra(obra_id));

create policy quentinhas_insere on public.quentinhas
  for insert to authenticated
  with check (
    public.tem_acesso_obra(obra_id)
    and not exists (
      select 1 from public.semanas s where s.id = semana_id and s.status = 'fechada'
    )
  );

create policy quentinhas_edita on public.quentinhas
  for update to authenticated
  using (
    public.tem_acesso_obra(obra_id)
    and (public.eh_admin() or not exists (
      select 1 from public.semanas s where s.id = semana_id and s.status = 'fechada'
    ))
  )
  with check (public.tem_acesso_obra(obra_id));

create policy quentinhas_admin_apaga on public.quentinhas
  for delete to authenticated
  using (public.eh_admin());

-- -----------------------------------------------------------------------------
-- Notas fiscais e fotos: o lancador fotografa a nota da obra dele.
-- -----------------------------------------------------------------------------
create policy notas_leitura on public.notas_fiscais
  for select to authenticated
  using (public.tem_acesso_obra(obra_id));

create policy notas_insere on public.notas_fiscais
  for insert to authenticated
  with check (public.tem_acesso_obra(obra_id));

create policy notas_edita on public.notas_fiscais
  for update to authenticated
  using (public.tem_acesso_obra(obra_id))
  with check (public.tem_acesso_obra(obra_id));

create policy notas_admin_apaga on public.notas_fiscais
  for delete to authenticated
  using (public.eh_admin());

create policy fotos_nota_acesso on public.fotos_nota
  for all to authenticated
  using (
    exists (
      select 1 from public.notas_fiscais n
      where n.id = nota_id and public.tem_acesso_obra(n.obra_id)
    )
  )
  with check (
    exists (
      select 1 from public.notas_fiscais n
      where n.id = nota_id and public.tem_acesso_obra(n.obra_id)
    )
  );

-- -----------------------------------------------------------------------------
-- Views seguras para o lancador: apenas colunas que ele pode ver.
-- Sao security_invoker = off (padrao), logo leem a tabela base com os direitos
-- do dono da view — por isso o filtro de acesso vai escrito no WHERE.
-- -----------------------------------------------------------------------------
create view public.obras_visiveis as
  select o.id,
         o.nome,
         o.endereco,
         o.status,
         o.data_inicio,
         o.forma_contratacao,
         c.nome as cliente_nome
  from public.obras o
  join public.clientes c on c.id = o.cliente_id
  where o.excluido_em is null
    and public.tem_acesso_obra(o.id);
comment on view public.obras_visiveis is
  'Obras que o usuario atual pode lancar, sem valor de contrato nem rateio.';

create view public.funcionarios_visiveis as
  select f.id, f.nome, f.tipo, f.funcao, f.status
  from public.funcionarios f
  where f.excluido_em is null;
comment on view public.funcionarios_visiveis is
  'Equipe para a tela de presenca, sem valor de diaria e sem chave PIX.';

create view public.locais_visiveis as
  select l.id, l.obra_id, l.nome, l.endereco
  from public.locais_obra l
  where l.excluido_em is null
    and public.tem_acesso_obra(l.obra_id);

grant select on public.obras_visiveis, public.funcionarios_visiveis, public.locais_visiveis
  to authenticated;

-- -----------------------------------------------------------------------------
-- Semana da obra: cria (ou devolve) a semana que contem a data.
-- As semanas sao numeradas a partir da data de inicio da obra (spec 4.5).
-- -----------------------------------------------------------------------------
create or replace function public.garantir_semana(p_obra_id uuid, p_data date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_segunda date;
  v_id      uuid;
  v_inicio  date;
  v_numero  integer;
begin
  if not public.tem_acesso_obra(p_obra_id) then
    raise exception 'sem acesso a esta obra';
  end if;

  -- segunda-feira da semana da data (domingo conta para a semana seguinte)
  v_segunda := p_data - ((extract(isodow from p_data)::int - 1) * interval '1 day');

  select id into v_id
  from public.semanas
  where obra_id = p_obra_id and data_inicio = v_segunda and excluido_em is null;
  if found then
    return v_id;
  end if;

  select data_inicio into v_inicio from public.obras where id = p_obra_id;
  v_inicio := coalesce(v_inicio, v_segunda);
  -- numero da semana contado a partir da segunda da semana de inicio da obra
  v_numero := 1 + floor(
    (v_segunda - (v_inicio - ((extract(isodow from v_inicio)::int - 1) * interval '1 day'))::date) / 7
  )::int;
  if v_numero < 1 then
    v_numero := 1;
  end if;
  -- se o numero ja existir (obra com semanas fora de ordem), pega o proximo livre
  while exists (select 1 from public.semanas where obra_id = p_obra_id and numero = v_numero) loop
    v_numero := v_numero + 1;
  end loop;

  insert into public.semanas (obra_id, numero, data_inicio, data_fim)
  values (p_obra_id, v_numero, v_segunda, v_segunda + 5)
  returning id into v_id;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- registrar_presenca: o lancador nao envia o valor da diaria — ele nem pode
-- ler essa coluna. O valor e resolvido aqui, no servidor, pelo cadastro do
-- funcionario e pelo percentual de meia diaria dos parametros.
-- O admin pode enviar p_valor_diaria para editar o valor no lancamento.
-- -----------------------------------------------------------------------------
create or replace function public.registrar_presenca(
  p_obra_id        uuid,
  p_funcionario_id uuid,
  p_data           date,
  p_tipo_diaria    public.tipo_diaria default 'cheia',
  p_valor_vale     bigint default 0,
  p_observacao     text default null,
  p_valor_diaria   bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_semana   uuid;
  v_base     bigint;
  v_pct_meia numeric;
  v_valor    bigint;
  v_id       uuid;
begin
  if not public.tem_acesso_obra(p_obra_id) then
    raise exception 'sem acesso a esta obra';
  end if;

  v_semana := public.garantir_semana(p_obra_id, p_data);

  if exists (select 1 from public.semanas where id = v_semana and status = 'fechada') then
    raise exception 'semana ja fechada';
  end if;

  select valor_diaria into v_base from public.funcionarios where id = p_funcionario_id;
  if v_base is null then
    raise exception 'funcionario nao encontrado';
  end if;

  select coalesce(valor::numeric, 0.5) into v_pct_meia
  from public.parametros where chave = 'percentual_meia_diaria';
  v_pct_meia := coalesce(v_pct_meia, 0.5);

  v_valor := case p_tipo_diaria
               when 'sem_diaria' then 0
               when 'meia'       then round(v_base * v_pct_meia)
               else v_base
             end;

  -- so o admin edita o valor no lancamento
  if p_valor_diaria is not null and public.eh_admin() then
    v_valor := case when p_tipo_diaria = 'sem_diaria' then 0 else p_valor_diaria end;
  end if;

  insert into public.lancamentos_diarios
    (obra_id, semana_id, funcionario_id, data, tipo_diaria, valor_diaria, valor_vale,
     observacao, criado_por)
  values
    (p_obra_id, v_semana, p_funcionario_id, p_data, p_tipo_diaria, v_valor,
     coalesce(p_valor_vale, 0), p_observacao, auth.uid())
  on conflict (obra_id, funcionario_id, data) where excluido_em is null
  do update set tipo_diaria   = excluded.tipo_diaria,
                valor_diaria  = excluded.valor_diaria,
                valor_vale    = excluded.valor_vale,
                observacao    = excluded.observacao,
                semana_id     = excluded.semana_id
  returning id into v_id;

  return v_id;
end;
$$;

-- Remove a presenca do dia (o toque que desmarca o funcionario).
create or replace function public.remover_presenca(
  p_obra_id uuid, p_funcionario_id uuid, p_data date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.tem_acesso_obra(p_obra_id) then
    raise exception 'sem acesso a esta obra';
  end if;
  if exists (
    select 1 from public.semanas s
    join public.lancamentos_diarios l on l.semana_id = s.id
    where l.obra_id = p_obra_id and l.funcionario_id = p_funcionario_id
      and l.data = p_data and s.status = 'fechada'
  ) then
    raise exception 'semana ja fechada';
  end if;
  -- exclusao logica: nada e apagado (spec 11.5)
  update public.lancamentos_diarios
     set excluido_em = now()
   where obra_id = p_obra_id and funcionario_id = p_funcionario_id
     and data = p_data and excluido_em is null;
end;
$$;

-- Quentinhas do dia: quantidade e valor unitario (o valor muda com o fornecedor).
create or replace function public.registrar_quentinha(
  p_obra_id uuid,
  p_data date,
  p_quantidade integer,
  p_valor_unitario bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_semana uuid;
  v_valor  bigint;
  v_id     uuid;
begin
  if not public.tem_acesso_obra(p_obra_id) then
    raise exception 'sem acesso a esta obra';
  end if;

  v_semana := public.garantir_semana(p_obra_id, p_data);
  if exists (select 1 from public.semanas where id = v_semana and status = 'fechada') then
    raise exception 'semana ja fechada';
  end if;

  v_valor := p_valor_unitario;
  if v_valor is null then
    select valor::bigint into v_valor from public.parametros where chave = 'valor_quentinha_padrao';
  end if;
  v_valor := coalesce(v_valor, 0);

  select id into v_id
  from public.quentinhas
  where obra_id = p_obra_id and data = p_data and valor_unitario = v_valor
    and excluido_em is null
  limit 1;

  if v_id is null then
    insert into public.quentinhas (obra_id, semana_id, data, quantidade, valor_unitario, criado_por)
    values (p_obra_id, v_semana, p_data, coalesce(p_quantidade, 0), v_valor, auth.uid())
    returning id into v_id;
  else
    update public.quentinhas
       set quantidade = coalesce(p_quantidade, 0), semana_id = v_semana
     where id = v_id;
  end if;

  return v_id;
end;
$$;

grant execute on function
  public.perfil_atual(), public.eh_admin(), public.tem_acesso_obra(uuid),
  public.garantir_semana(uuid, date),
  public.registrar_presenca(uuid, uuid, date, public.tipo_diaria, bigint, text, bigint),
  public.remover_presenca(uuid, uuid, date),
  public.registrar_quentinha(uuid, date, integer, bigint)
  to authenticated;

-- Cria a linha em public.usuarios quando um usuario e criado no Auth.
create or replace function public.ao_criar_usuario_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nome, email, perfil)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'perfil')::public.perfil_usuario, 'lancador')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


-- ###########################################################################
-- 0003_seed.sql
-- ###########################################################################

-- =============================================================================
-- RV Engenharia — carga inicial
-- Regra 11.6: todo valor de referencia mora em parametros, nunca no codigo.
-- Valores monetarios em parametros sao gravados em CENTAVOS.
-- =============================================================================

insert into public.parametros (chave, valor, descricao) values
  -- Empresa (rodape de todo documento — spec 4.17)
  ('empresa_nome',        'RV Engenharia',                          'Nome da empresa'),
  ('empresa_endereco',    'Av. Zequinha Freire, 3531 — Teresina/PI', 'Endereco do rodape'),
  ('empresa_telefone',    '(86) 99437-9883',                        'Telefone do rodape'),
  ('empresa_email',       'rvengenhariathe@gmail.com',              'E-mail do rodape'),
  ('empresa_instagram',   '@rvengenhariathe',                       'Instagram do rodape'),
  ('responsavel_nome',    'Rubens Veras Guimaraes',                 'Responsavel tecnico'),
  ('responsavel_titulo',  'Eng. Civil',                             'Titulo do responsavel'),
  ('responsavel_crea',    'CREA-PI 35900',                          'Registro do responsavel'),
  ('empresa_logo_url',    '',                                       'URL da logo no topo dos documentos'),

  -- Obras civis
  ('valor_quentinha_padrao',   '1800', 'Valor unitario padrao da quentinha, em centavos'),
  ('faixas_quentinha',         '[1500,1800,2200]', 'Faixas de valor de quentinha ja usadas (centavos)'),
  ('percentual_meia_diaria',   '0.5',  'Meia diaria: fracao do valor cheio (spec 14.1)'),
  ('percentual_rateio_parceiro','0.5', 'Rateio padrao do resultado com o parceiro (spec 14.2)'),
  ('base_rateio_parceiro',     'resultado_total', 'resultado_total | margem_mao_obra (spec 14.2)'),
  ('sabado_sem_quentinha',     'true', 'Sabado: diaria integral e sem quentinha'),

  -- Orcamento
  ('margem_padrao',  '0.30', 'Margem padrao sobre o custo'),
  ('bdi_padrao',     '0.25', 'BDI padrao do orcamento completo'),

  -- Energia solar (spec 5.3)
  ('solar_hsp',                   '5.4',  'HSP de Teresina em kWh/m2.dia'),
  ('solar_performance_ratio',     '0.78', 'Performance ratio do sistema'),
  ('solar_disp_monofasica',       '30',   'Custo de disponibilidade monofasico, em kWh'),
  ('solar_disp_bifasica',         '50',   'Custo de disponibilidade bifasico, em kWh'),
  ('solar_disp_trifasica',        '100',  'Custo de disponibilidade trifasico, em kWh'),
  ('solar_degradacao_anual',      '0.0055', 'Degradacao anual dos modulos'),
  ('solar_fator_inversor',        '0.80', 'Fator de dimensionamento do inversor (0,75 a 1,00)'),
  ('solar_percentual_fio_b',      '{"2023":0.15,"2024":0.30,"2025":0.45,"2026":0.60,"2027":0.75,"2028":0.90}',
                                          'Percentual do Fio B por ano — Lei 14.300'),
  ('solar_tarifa_fio_b',          '30',   'Tarifa do Fio B em centavos por kWh'),
  ('solar_projeto_art',           '150000', 'Projeto, ART e homologacao, em centavos'),
  ('solar_mao_obra_kwp',          '50000', 'Mao de obra de instalacao em centavos por kWp'),
  ('solar_margem',                '0.30', 'Margem da proposta solar — nunca aparece no documento'),
  ('solar_concessionaria_padrao', 'Equatorial Piaui', 'Concessionaria padrao'),

  -- Textos padrao das condicoes comerciais (spec 8)
  ('texto_prazo_execucao', 'Prazo de execucao a combinar apos a assinatura do contrato.', 'Texto padrao de prazo'),
  ('texto_validade',       'Proposta valida por 15 dias.', 'Texto padrao de validade'),
  ('texto_garantia',       'Garantia de 5 anos para os servicos executados, conforme o Codigo Civil.', 'Texto padrao de garantia'),
  ('texto_nao_incluso',    'Nao estao inclusos: itens nao descritos nesta proposta.', 'Texto padrao do que nao esta incluso'),
  ('cotacao_dias_alerta',  '30', 'Dias a partir dos quais a cotacao e sinalizada como antiga')
on conflict (chave) do nothing;

-- Fornecedores ja usados, para autocompletar na tela de nota (spec 4.6)
insert into public.fornecedores (nome, categoria) values
  ('J. Monte', 'material'),
  ('Baratao das Construcoes', 'material'),
  ('Engecopi', 'material'),
  ('PH Deposito', 'material'),
  ('Hidroeletrica Engenharia', 'material'),
  ('Hidroeletrica Center', 'material'),
  ('Comercial Barroso', 'material'),
  ('Kalfort', 'material'),
  ('Comercial Constru Leste', 'material'),
  ('Solucao em Materiais de Construcao', 'material'),
  ('B F Eletrica', 'material'),
  ('Mestre da Obra', 'locacao'),
  ('Sul Entulho', 'cacamba'),
  ('L & A Parafusos', 'material'),
  ('JN Construcoes', 'material'),
  ('M & W Materiais', 'material'),
  ('Fix Ferramentas', 'material'),
  ('Alex Construcoes', 'material'),
  ('Nara L L Silva', 'material'),
  ('Ponto do Gesso', 'material'),
  ('Piaui Materiais', 'material'),
  ('Ferroleste', 'material'),
  ('G C Comercio e Servicos', 'material'),
  ('Barroso Sao Cristovao', 'material')
on conflict do nothing;


-- ###########################################################################
-- 0004_storage.sql
-- ###########################################################################

-- =============================================================================
-- RV Engenharia — buckets de arquivos
--
-- Convencao de caminho: o primeiro nivel da pasta e sempre o id da obra
--   notas-fiscais/<obra_id>/<nota_id>/<arquivo>
--   comprovantes/<obra_id>/<pagamento_id>/<arquivo>
--   arquivos/<obra_id>/<arquivo>
-- E o que permite a policy decidir o acesso por obra: o lancador so alcanca a
-- pasta das obras a que esta vinculado.
--
-- Todos os buckets sao privados. As telas usam URL assinada de curta duracao.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('notas-fiscais', 'notas-fiscais', false, 10485760,
   array['image/jpeg','image/png','image/webp','image/heic','application/pdf']),
  ('comprovantes',  'comprovantes',  false, 10485760,
   array['image/jpeg','image/png','image/webp','image/heic','application/pdf']),
  ('arquivos',      'arquivos',      false, 52428800, null),
  ('documentos',    'documentos',    false, 52428800, null),
  ('publico',       'publico',       true,  5242880,
   array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do nothing;

-- Obra dona do arquivo, lida do primeiro nivel do caminho.
create or replace function public.obra_do_caminho(p_nome text)
returns uuid
language plpgsql
immutable
as $$
declare v uuid;
begin
  begin
    v := (storage.foldername(p_nome))[1]::uuid;
  exception when others then
    return null;
  end;
  return v;
end;
$$;

-- Leitura: admin ve tudo; lancador so as pastas das obras dele.
create policy "anexos leitura por obra"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('notas-fiscais', 'comprovantes', 'arquivos', 'documentos')
    and public.tem_acesso_obra(public.obra_do_caminho(name))
  );

create policy "anexos envio por obra"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('notas-fiscais', 'comprovantes', 'arquivos', 'documentos')
    and public.tem_acesso_obra(public.obra_do_caminho(name))
  );

create policy "anexos atualizacao por obra"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('notas-fiscais', 'comprovantes', 'arquivos', 'documentos')
    and public.tem_acesso_obra(public.obra_do_caminho(name))
  );

-- Apagar arquivo e do admin: nada some da obra por conta do lancador.
create policy "anexos exclusao pelo admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('notas-fiscais', 'comprovantes', 'arquivos', 'documentos')
    and public.eh_admin()
  );

-- Bucket publico: so a logo e material de identidade, gravado pelo admin.
create policy "publico leitura"
  on storage.objects for select to public
  using (bucket_id = 'publico');

create policy "publico escrita pelo admin"
  on storage.objects for all to authenticated
  using (bucket_id = 'publico' and public.eh_admin())
  with check (bucket_id = 'publico' and public.eh_admin());


-- ###########################################################################
-- 0005_servico_quantidade.sql
-- ###########################################################################

-- =============================================================================
-- Quantidade e unidade no servico do fechamento.
--
-- A versao de exibicao do item 4.14 permite "mostrar quantidade e unidade", e o
-- servico importado das medicoes ja nasce com a quantidade executada. Sem estas
-- colunas essa opcao nao teria o que mostrar.
-- =============================================================================

alter table public.servicos_executados
  add column if not exists quantidade numeric(14,4),
  add column if not exists unidade    text;

comment on column public.servicos_executados.quantidade is
  'Quantidade executada; alimenta o preco unitario do relatorio quando informada.';


-- ###########################################################################
-- 0006_orcamento.sql
-- ###########################################################################

-- =============================================================================
-- Base de precos referenciais e complementos do orcamento (spec 4.13)
--
-- A especificacao pede SINAPI, ORSE e SICRO do Piaui importaveis por CSV, com
-- data-base e codigo da composicao. O modelo do item 9 nao previa onde guardar
-- essas composicoes — e aqui.
-- =============================================================================

create table public.precos_referencia (
  id             uuid primary key default gen_random_uuid(),
  base           public.base_referencia not null,   -- SINAPI | ORSE | SICRO
  codigo         text not null,
  descricao      text not null,
  unidade        text,
  preco_unitario bigint not null default 0,
  -- data-base da tabela publicada (ex.: SINAPI PI 05/2026)
  data_base      date,
  uf             text default 'PI',
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  excluido_em    timestamptz
);

-- a mesma composicao aparece em varias data-bases: o que nao pode repetir e a
-- combinacao base + codigo + data-base + UF
create unique index precos_referencia_unicos
  on public.precos_referencia (base, codigo, coalesce(data_base, '1900-01-01'), coalesce(uf, ''))
  where excluido_em is null;

create index on public.precos_referencia (base, data_base desc);
create index on public.precos_referencia using gin (to_tsvector('portuguese', descricao));

alter table public.precos_referencia enable row level security;

create policy admin_total on public.precos_referencia
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

grant select, insert, update, delete on public.precos_referencia to authenticated;

create trigger t_atualizado_em_precos_referencia
  before update on public.precos_referencia
  for each row execute function public.tocar_atualizado_em();

-- -----------------------------------------------------------------------------
-- Complementos do orcamento
-- -----------------------------------------------------------------------------

-- Aba de pendencias / itens a definir (spec 4.13)
alter table public.itens_orcamento
  add column if not exists pendencia  boolean not null default false,
  add column if not exists observacao text;

comment on column public.itens_orcamento.pendencia is
  'Item ainda a definir; sai na aba de pendencias, nunca no total.';

-- Memorial descritivo, gerado junto com a planilha (spec 4.13)
alter table public.orcamentos
  add column if not exists memorial text,
  add column if not exists margem   numeric(5,4) not null default 0.30;

comment on column public.orcamentos.margem is
  'Margem sobre o custo, usada quando o item nao tem preco unitario proprio.';


-- ###########################################################################
-- 0007_parametros_solar.sql
-- ###########################################################################

-- =============================================================================
-- Parametros que a cotacao solar passou a usar (spec 5.5).
-- Regra 11.6: valor de referencia mora em parametros, nunca no codigo.
-- =============================================================================

insert into public.parametros (chave, valor, descricao) values
  ('solar_potencia_modulo_wp', '610',  'Potencia do modulo padrao, em Wp'),
  ('solar_area_modulo_m2',     '2.79', 'Area do modulo padrao, em m2'),
  ('solar_frete_percentual',   '0',    'Frete como fracao do custo quando nao ha valor informado')
on conflict (chave) do nothing;


-- ###########################################################################
-- 0008_identidade_visivel.sql
-- ###########################################################################

-- =============================================================================
-- 0008 — A identidade da empresa visivel para todo mundo
--
-- A tabela `parametros` e de administrador, e com razao: ela guarda margem,
-- BDI e percentual de meia diaria, que o lancador nao pode ver (regra 11.1).
--
-- Mas ela guarda tambem a identidade da empresa — nome, endereco, telefone,
-- logo, responsavel tecnico e CREA. Isso sai impresso no rodape de todo
-- documento que vai ao cliente: nao e segredo de ninguem. Sem poder ler
-- essas chaves, o app mostraria a logo para o administrador e um monograma
-- generico para o lancador, no mesmo aplicativo.
--
-- Mesmo padrao das outras views seguras deste banco: security_invoker fica
-- no padrao (off), entao a view le a tabela com os direitos do dono, e o
-- filtro do que pode sair vai escrito no WHERE.
-- =============================================================================

create view public.identidade_visivel as
  select p.chave, p.valor
  from public.parametros p
  where p.chave in (
    'empresa_nome',
    'empresa_endereco',
    'empresa_telefone',
    'empresa_email',
    'empresa_instagram',
    'empresa_logo_url',
    'responsavel_nome',
    'responsavel_titulo',
    'responsavel_crea'
  );

comment on view public.identidade_visivel is
  'Identidade da empresa para o cabecalho do app e o rodape dos documentos. '
  'So as chaves que ja saem impressas ao cliente — nunca margem, BDI ou diaria.';

-- A tela de login mostra a logo antes de haver sessao, entao o anonimo tambem le.
grant select on public.identidade_visivel to anon, authenticated;


-- ###########################################################################
-- 0009_desoneracao.sql
-- ###########################################################################

-- =============================================================================
-- 0009 — Desonerada ou nao desonerada, registrado no preco
--
-- O SINAPI publica duas versoes de cada tabela. A desonerada nao carrega o INSS
-- sobre a folha (Lei 12.546/2011), entao todo preco que tem mao de obra sai
-- mais barato. Sao numeros diferentes para o mesmo codigo, no mesmo mes, na
-- mesma UF.
--
-- Sem esta coluna, importar as duas versoes fazia uma sobrescrever a outra em
-- silencio, pela chave unica antiga (base + codigo + data-base + UF). O erro
-- nao apareceria na tela: apareceria no valor de um orcamento.
--
-- A RV trabalha com a NAO desonerada, que e o usual em obra privada. Fica como
-- padrao, e a outra continua importavel sem conflito.
-- =============================================================================

alter table public.precos_referencia
  add column if not exists desonerado boolean not null default false;

comment on column public.precos_referencia.desonerado is
  'true = tabela desonerada (sem INSS sobre a folha). A RV usa a nao desonerada.';

-- A chave unica passa a separar as duas versoes.
drop index if exists precos_referencia_unicos;

create unique index precos_referencia_unicos
  on public.precos_referencia
     (base, codigo, coalesce(data_base, '1900-01-01'), coalesce(uf, ''), desonerado)
  where excluido_em is null;


-- -----------------------------------------------------------------------------
-- O item do orcamento congela o preco no momento em que entra. Passa a congelar
-- tambem DE ONDE aquele preco veio: sem a data-base e a versao, o documento diz
-- "SINAPI 88489" sem dizer qual SINAPI, e ninguem consegue conferir o numero.
-- -----------------------------------------------------------------------------
alter table public.itens_orcamento
  add column if not exists referencia_data_base  date,
  add column if not exists referencia_desonerado boolean;

comment on column public.itens_orcamento.referencia_data_base is
  'Data-base da tabela de onde o preco veio, congelada junto com o preco.';
comment on column public.itens_orcamento.referencia_desonerado is
  'Versao da tabela de onde o preco veio. Nulo em item de preco proprio.';


-- ###########################################################################
-- Trigger que cria o perfil do usuario quando ele nasce no Auth
-- ###########################################################################

drop trigger if exists ao_criar_usuario on auth.users;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.ao_criar_usuario_auth();

-- ###########################################################################
-- Conferencia final
-- ###########################################################################

do $conferencia$
declare
  v_tabelas    int;
  v_parametros int;
  v_buckets    int;
  v_sem_rls    text;
begin
  select count(*) into v_tabelas from pg_tables where schemaname = 'public';
  select count(*) into v_parametros from public.parametros;
  select count(*) into v_buckets from storage.buckets
    where id in ('notas-fiscais','comprovantes','arquivos','documentos','publico');

  select coalesce(string_agg(t.tablename, ', '), 'nenhuma') into v_sem_rls
  from pg_tables t
  where t.schemaname = 'public'
    and not exists (
      select 1 from pg_class c where c.relname = t.tablename and c.relrowsecurity
    );

  if v_tabelas <> 36 or v_parametros <> 38 or v_buckets <> 5 or v_sem_rls <> 'nenhuma' then
    raise exception
      'Instalacao incompleta: % tabelas (esperado 36), % parametros (esperado 38), % buckets (esperado 5), sem protecao: %. Nada foi gravado.',
      v_tabelas, v_parametros, v_buckets, v_sem_rls;
  end if;

  raise notice '--------------------------------------------------';
  raise notice 'INSTALACAO CONCLUIDA COM SUCESSO';
  raise notice 'Tabelas ............. %', v_tabelas;
  raise notice 'Parametros .......... %', v_parametros;
  raise notice 'Buckets de arquivo .. %', v_buckets;
  raise notice 'Tabelas sem protecao. %', v_sem_rls;
  raise notice '--------------------------------------------------';
  raise notice 'PROXIMO PASSO: crie seu usuario em Authentication > Users';
  raise notice 'e depois rode, aqui mesmo:';
  raise notice '  update public.usuarios set perfil = ''admin'' where email = ''SEU@EMAIL.COM'';';
  raise notice '--------------------------------------------------';
end
$conferencia$;

commit;
