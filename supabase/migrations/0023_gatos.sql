-- Documentos > Gatos: cada gato tem data de nascimento, vacinas, vermífugo,
-- consultas, exames (com arquivo), peso e documentos livres. As próximas
-- vacinas e vermífugos também saem no calendário assinável (.ics).
-- Os arquivos dos exames ficam no bucket privado `confidencial` (0010), subpasta `gatos/`.
create table gatos (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    nascimento date,
    ordem integer not null default 0,
    criado_em timestamptz not null default now()
);

create table gato_vacinas (
    id uuid primary key default gen_random_uuid(),
    gato_id uuid not null references gatos(id) on delete cascade,
    vacina text not null,
    data date not null,
    proxima_data date,
    criado_em timestamptz not null default now()
);

create table gato_vermifugos (
    id uuid primary key default gen_random_uuid(),
    gato_id uuid not null references gatos(id) on delete cascade,
    data date not null,
    produto text not null,
    proxima_data date,
    criado_em timestamptz not null default now()
);

create table gato_consultas (
    id uuid primary key default gen_random_uuid(),
    gato_id uuid not null references gatos(id) on delete cascade,
    data date not null,
    veterinario text,
    observacao text,
    criado_em timestamptz not null default now()
);

create table gato_exames (
    id uuid primary key default gen_random_uuid(),
    gato_id uuid not null references gatos(id) on delete cascade,
    data date not null,
    nome text not null,
    arquivo_url text not null,
    nome_arquivo text not null,
    criado_em timestamptz not null default now()
);

create table gato_pesos (
    id uuid primary key default gen_random_uuid(),
    gato_id uuid not null references gatos(id) on delete cascade,
    data date not null,
    peso_kg numeric(5, 2) not null check (peso_kg > 0),
    criado_em timestamptz not null default now()
);

create index idx_gato_vacinas_gato on gato_vacinas(gato_id, data);
create index idx_gato_vermifugos_gato on gato_vermifugos(gato_id, data);
create index idx_gato_consultas_gato on gato_consultas(gato_id, data);
create index idx_gato_exames_gato on gato_exames(gato_id, data);
create index idx_gato_pesos_gato on gato_pesos(gato_id, data);

alter table gatos enable row level security;
alter table gato_vacinas enable row level security;
alter table gato_vermifugos enable row level security;
alter table gato_consultas enable row level security;
alter table gato_exames enable row level security;
alter table gato_pesos enable row level security;

create policy "authenticated_full_access_gatos" on gatos
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_gato_vacinas" on gato_vacinas
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_gato_vermifugos" on gato_vermifugos
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_gato_consultas" on gato_consultas
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_gato_exames" on gato_exames
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_gato_pesos" on gato_pesos
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Documentos livres de cada gato: mesma tabela das outras áreas, com a área 'gatos'.
alter table documentos drop constraint documentos_area_check;
alter table documentos add constraint documentos_area_check check (area in ('pessoais', 'apartamento', 'arquivo', 'outros', 'gatos'));
alter table documentos add column gato_id uuid references gatos(id) on delete cascade;
alter table documentos add constraint gato_obrigatorio_se_gatos check ((area = 'gatos') = (gato_id is not null));
create index idx_documentos_gato on documentos(gato_id);

-- Links de calendário: quais incluem as próximas vacinas e vermífugos dos gatos.
-- Os que já valiam para todas as pessoas passam a incluí-los.
alter table documentos_calendario_feeds add column incluir_gatos boolean not null default false;
update documentos_calendario_feeds f
set incluir_gatos = true
where not exists (select 1 from documentos_calendario_feed_pessoas p where p.feed_id = f.id);
