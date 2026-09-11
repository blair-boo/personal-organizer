-- Tags de itens (flat, multi-tag) no lugar da hierarquia cômodo/subcategoria: um item
-- pode ter várias tags pra facilitar filtro. Classificações de manutenção viram
-- "Classificações de Tarefas" e também passam a ser multi-tag por tarefa.

create table tags_itens (
    id uuid primary key default gen_random_uuid(),
    nome text not null unique,
    cor text,
    icone_url text,
    criado_em timestamptz not null default now()
);

create table item_tags (
    item_id uuid not null references itens(id) on delete cascade,
    tag_id uuid not null references tags_itens(id) on delete cascade,
    primary key (item_id, tag_id)
);

alter table itens drop column categoria_id;
drop table categorias_itens;

alter table tags_itens enable row level security;
create policy "authenticated_full_access_tags_itens" on tags_itens
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table item_tags enable row level security;
create policy "authenticated_full_access_item_tags" on item_tags
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table classificacoes_manutencao rename to classificacoes_tarefas;
alter policy "authenticated_full_access_classificacoes_manutencao" on classificacoes_tarefas
    rename to "authenticated_full_access_classificacoes_tarefas";

create table tarefa_classificacoes (
    tarefa_id uuid not null references tarefas_manutencao(id) on delete cascade,
    classificacao_id uuid not null references classificacoes_tarefas(id) on delete cascade,
    primary key (tarefa_id, classificacao_id)
);

alter table tarefas_manutencao drop column classificacao_id;

alter table tarefa_classificacoes enable row level security;
create policy "authenticated_full_access_tarefa_classificacoes" on tarefa_classificacoes
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
