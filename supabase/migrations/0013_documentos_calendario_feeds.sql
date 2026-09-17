-- Substitui o link único de calendário (documentos_calendario_config) por
-- vários links independentes: cada um com nome, token próprio e a lista de
-- pessoas que inclui (nenhuma linha em documentos_calendario_feed_pessoas =
-- inclui todas). A pessoa pode ter um link "Todos" e outros só de uma
-- pessoa específica ao mesmo tempo, e editar quem está incluído sem trocar
-- a URL, ou gerar um token novo pra invalidar um link específico.
create table documentos_calendario_feeds (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    token text not null unique default encode(gen_random_bytes(24), 'hex'),
    criado_em timestamptz not null default now()
);

create table documentos_calendario_feed_pessoas (
    feed_id uuid not null references documentos_calendario_feeds(id) on delete cascade,
    pessoa_id uuid not null references documentos_pessoas(id) on delete cascade,
    primary key (feed_id, pessoa_id)
);

alter table documentos_calendario_feeds enable row level security;
alter table documentos_calendario_feed_pessoas enable row level security;
create policy "authenticated_full_access_documentos_calendario_feeds" on documentos_calendario_feeds
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_documentos_calendario_feed_pessoas" on documentos_calendario_feed_pessoas
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Preserva o link único que já existia (sem pessoa = todas), pra quem já
-- assinou no Calendário/Google Calendar não precisar assinar de novo.
insert into documentos_calendario_feeds (nome, token)
select 'Todos', token from documentos_calendario_config where id = 1;

drop table documentos_calendario_config;
