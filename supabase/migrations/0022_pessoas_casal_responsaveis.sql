-- Casal como junção de duas pessoas, ligação entre o login e a pessoa, e
-- responsáveis das tarefas de manutenção (com quem fez cada execução).

-- Cada cadastro de Documentos > Pessoais é uma pessoa ou um casal (que junta duas pessoas).
-- usuario_id liga a pessoa ao login dela, pra "Feita hoje" já marcar quem está usando o app.
alter table documentos_pessoas
    add column tipo text not null default 'pessoa' check (tipo in ('pessoa', 'casal')),
    add column usuario_id uuid unique references auth.users(id) on delete set null;

create table documentos_casal_membros (
    casal_id uuid not null references documentos_pessoas(id) on delete cascade,
    pessoa_id uuid not null references documentos_pessoas(id) on delete cascade,
    primary key (casal_id, pessoa_id),
    check (casal_id <> pessoa_id)
);

alter table documentos_casal_membros enable row level security;
create policy "authenticated_full_access_documentos_casal_membros" on documentos_casal_membros
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- O cadastro "Casal" que já existia passa a juntar Eduardo e Mariana.
update documentos_pessoas set tipo = 'casal' where nome = 'Casal';
insert into documentos_casal_membros (casal_id, pessoa_id)
select c.id, p.id
from documentos_pessoas c, documentos_pessoas p
where c.nome = 'Casal' and p.nome in ('Eduardo', 'Mariana')
on conflict do nothing;

-- O único login que existe hoje é o da Mariana.
update documentos_pessoas
set usuario_id = (select id from auth.users order by created_at limit 1)
where nome = 'Mariana' and usuario_id is null and (select count(*) from auth.users) = 1;

-- Responsável da tarefa: nenhum, uma pessoa, ou o casal (qualquer um dos dois / os dois juntos).
alter table tarefas_manutencao
    add column responsavel_tipo text not null default 'nenhum' check (responsavel_tipo in ('nenhum', 'pessoa', 'qualquer', 'juntos')),
    add column responsavel_pessoa_id uuid references documentos_pessoas(id) on delete set null,
    add column responsavel_casal_id uuid references documentos_pessoas(id) on delete set null;

-- Quem fez cada execução (uma ou mais pessoas; as duas juntas = fizeram juntas).
create table tarefas_historico_pessoas (
    historico_id uuid not null references tarefas_manutencao_historico(id) on delete cascade,
    pessoa_id uuid not null references documentos_pessoas(id) on delete cascade,
    primary key (historico_id, pessoa_id)
);

alter table tarefas_historico_pessoas enable row level security;
create policy "authenticated_full_access_tarefas_historico_pessoas" on tarefas_historico_pessoas
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
