-- Bucket `comprovantes` (PDF de extrato e fatura): acesso conforme a conta dona do arquivo.
-- O caminho sempre começa com o id da conta (caminhoComprovante em src/lib/storage.ts):
--   {contaId}/{extrato|fatura}_{banco}_{AA-MM}.{ext}
-- Ver o arquivo exige pode_ver_conta; enviar, trocar ou apagar exige pode_editar_conta.

create function conta_do_caminho(p_nome text) returns uuid
language sql immutable set search_path = public as $$
    select case
        when split_part(p_nome, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then split_part(p_nome, '/', 1)::uuid
        else null
    end;
$$;

grant execute on function conta_do_caminho(text) to authenticated;

drop policy "authenticated_full_access_comprovantes" on storage.objects;

create policy "comprovantes_leitura" on storage.objects
    for select to authenticated
    using (bucket_id = 'comprovantes' and pode_ver_conta(conta_do_caminho(name)));

create policy "comprovantes_insercao" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'comprovantes' and pode_editar_conta(conta_do_caminho(name)));

create policy "comprovantes_alteracao" on storage.objects
    for update to authenticated
    using (bucket_id = 'comprovantes' and pode_editar_conta(conta_do_caminho(name)))
    with check (bucket_id = 'comprovantes' and pode_editar_conta(conta_do_caminho(name)));

create policy "comprovantes_exclusao" on storage.objects
    for delete to authenticated
    using (bucket_id = 'comprovantes' and pode_editar_conta(conta_do_caminho(name)));
