-- Painel de usuários (Settings > Usuários).
--  * perfis: um por login (auth.users), com e-mail, papel (admin/membro) e se o convite já foi aceito.
--    É criado por trigger assim que o login nasce, inclusive no convite, antes de a pessoa aceitar.
--  * Só admin altera papel; o app precisa ter sempre pelo menos um admin.
--  * Só admin vincula um login a uma pessoa (documentos_pessoas.usuario_id).
-- Convidar e excluir login passam pela edge function `gerenciar-usuarios` (chave de serviço).

create table perfis (
    usuario_id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    papel text not null default 'membro' check (papel in ('admin', 'membro')),
    confirmado boolean not null default false,
    criado_em timestamptz not null default now()
);

alter table perfis enable row level security;

create function eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from perfis where usuario_id = auth.uid() and papel = 'admin');
$$;

revoke all on function eh_admin() from public;
grant execute on function eh_admin() to authenticated;

create policy "perfis_leitura_autenticados" on perfis
    for select to authenticated using (true);

create policy "perfis_alteracao_admin" on perfis
    for update to authenticated using (eh_admin()) with check (eh_admin());

-- Mantém o perfil em dia com auth.users (criação, troca de e-mail, aceite do convite).
create function sincronizar_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    insert into perfis (usuario_id, email, confirmado)
    values (new.id, coalesce(new.email, ''), new.email_confirmed_at is not null)
    on conflict (usuario_id) do update
        set email = excluded.email, confirmado = excluded.confirmado;
    return new;
end;
$$;

create trigger auth_users_sincronizar_perfil
    after insert or update of email, email_confirmed_at on auth.users
    for each row execute function sincronizar_perfil();

-- Logins que já existem; a Mariana (ou, sem vínculo, o login mais antigo) começa como admin.
insert into perfis (usuario_id, email, confirmado)
select id, coalesce(email, ''), email_confirmed_at is not null from auth.users
on conflict (usuario_id) do nothing;

update perfis set papel = 'admin'
where usuario_id = coalesce(
    (select usuario_id from documentos_pessoas where nome = 'Mariana' and usuario_id is not null limit 1),
    (select id from auth.users order by created_at limit 1)
);

create function proteger_ultimo_admin() returns trigger
language plpgsql as $$
begin
    if old.papel = 'admin' and new.papel <> 'admin'
       and not exists (select 1 from perfis where papel = 'admin' and usuario_id <> old.usuario_id) then
        raise exception 'O app precisa ter pelo menos um admin.';
    end if;
    return new;
end;
$$;

create trigger perfis_proteger_ultimo_admin
    before update of papel on perfis
    for each row execute function proteger_ultimo_admin();

-- Quem usa o app (auth.uid() preenchido) só vincula login a pessoa se for admin.
-- SQL do painel do Supabase e edge functions (sem auth.uid()) passam.
create function restringir_vinculo_usuario() returns trigger
language plpgsql as $$
begin
    if auth.uid() is not null and not eh_admin()
       and new.usuario_id is distinct from (case when tg_op = 'UPDATE' then old.usuario_id else null end) then
        raise exception 'Só um admin pode vincular um login a uma pessoa.';
    end if;
    return new;
end;
$$;

create trigger documentos_pessoas_restringir_vinculo
    before insert or update of usuario_id on documentos_pessoas
    for each row execute function restringir_vinculo_usuario();
