-- Token secreto usado pela Edge Function `documentos-ics` (feed de assinatura
-- de calendário dos vencimentos de Documentos > Pessoais). Linha única
-- (singleton) — o app é de usuário único, não precisa de um token por pessoa.
-- pgcrypto já está habilitado desde 0001_core.sql.
create table documentos_calendario_config (
    id smallint primary key default 1 check (id = 1),
    token text not null default encode(gen_random_bytes(24), 'hex'),
    atualizado_em timestamptz not null default now()
);

insert into documentos_calendario_config (id) values (1);

alter table documentos_calendario_config enable row level security;
create policy "authenticated_full_access_documentos_calendario_config" on documentos_calendario_config
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
