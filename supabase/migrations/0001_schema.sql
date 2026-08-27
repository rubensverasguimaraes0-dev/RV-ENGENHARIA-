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
