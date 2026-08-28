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
