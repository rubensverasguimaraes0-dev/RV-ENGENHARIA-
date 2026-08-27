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
