-- Buckets privados de Storage (acesso só autenticado) + policies.
insert into storage.buckets (id, name, public)
values
    ('comprovantes', 'comprovantes', false),
    ('itens-docs', 'itens-docs', false),
    ('projetos-anexos', 'projetos-anexos', false),
    ('icones', 'icones', false)
on conflict (id) do nothing;

create policy "authenticated_full_access_comprovantes" on storage.objects
    for all using (bucket_id = 'comprovantes' and auth.role() = 'authenticated')
    with check (bucket_id = 'comprovantes' and auth.role() = 'authenticated');

create policy "authenticated_full_access_itens_docs" on storage.objects
    for all using (bucket_id = 'itens-docs' and auth.role() = 'authenticated')
    with check (bucket_id = 'itens-docs' and auth.role() = 'authenticated');

create policy "authenticated_full_access_projetos_anexos" on storage.objects
    for all using (bucket_id = 'projetos-anexos' and auth.role() = 'authenticated')
    with check (bucket_id = 'projetos-anexos' and auth.role() = 'authenticated');

create policy "authenticated_full_access_icones" on storage.objects
    for all using (bucket_id = 'icones' and auth.role() = 'authenticated')
    with check (bucket_id = 'icones' and auth.role() = 'authenticated');
