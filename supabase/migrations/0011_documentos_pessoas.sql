-- Pessoas dinâmicas em Documentos > Pessoais (antes fixo em 'mariana'/'casal').
-- Permite renomear, excluir e adicionar novas pessoas pelo próprio app.
create table documentos_pessoas (
    id uuid primary key default gen_random_uuid(),
    nome text not null unique,
    ordem integer not null default 0,
    criado_em timestamptz not null default now()
);

alter table documentos_pessoas enable row level security;
create policy "authenticated_full_access_documentos_pessoas" on documentos_pessoas
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Renomeia Mariana -> Rat_1 aqui mesmo, na semente.
insert into documentos_pessoas (nome, ordem) values ('Rat_1', 1), ('Casal', 2);

alter table documentos add column pessoa_id uuid references documentos_pessoas(id) on delete cascade;

update documentos set pessoa_id = (select id from documentos_pessoas where nome = 'Rat_1') where pessoa = 'mariana';
update documentos set pessoa_id = (select id from documentos_pessoas where nome = 'Casal') where pessoa = 'casal';

alter table documentos drop constraint pessoa_obrigatoria_se_pessoais;
drop index if exists idx_documentos_area;
alter table documentos drop column pessoa;

alter table documentos add constraint pessoa_obrigatoria_se_pessoais check (area <> 'pessoais' or pessoa_id is not null);
create index idx_documentos_area on documentos(area, pessoa_id);
