-- Apartamento: categorias de itens (cômodo/subcategoria), itens, projetos e manutenção recorrente.
create table categorias_itens (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    parent_id uuid references categorias_itens(id) on delete cascade,
    icone_url text,
    ordem integer not null default 0,
    criado_em timestamptz not null default now(),
    unique (parent_id, nome)
);

create index idx_categorias_itens_parent_id on categorias_itens(parent_id);

create table itens (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    categoria_id uuid references categorias_itens(id) on delete set null,
    marca text,
    modelo text,
    data_compra date,
    garantia_ate date,
    valor numeric(12, 2),
    observacoes text,
    criado_em timestamptz not null default now()
);

create index idx_itens_categoria on itens(categoria_id);

create table item_documentos (
    id uuid primary key default gen_random_uuid(),
    item_id uuid not null references itens(id) on delete cascade,
    tipo text not null check (tipo in ('nota_fiscal', 'manual', 'outro')),
    descricao text,
    arquivo_url text not null,
    nome_arquivo text not null,
    criado_em timestamptz not null default now(),
    constraint descricao_obrigatoria_se_outro check (tipo <> 'outro' or descricao is not null)
);

create index idx_item_documentos_item on item_documentos(item_id);

create table projetos (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    descricao text,
    status text not null default 'planejado' check (status in ('planejado', 'andamento', 'concluido')),
    data_inicio date,
    data_conclusao date,
    criado_em timestamptz not null default now()
);

create table projeto_anexos (
    id uuid primary key default gen_random_uuid(),
    projeto_id uuid not null references projetos(id) on delete cascade,
    descricao text,
    arquivo_url text not null,
    nome_arquivo text not null,
    criado_em timestamptz not null default now()
);

create index idx_projeto_anexos_projeto on projeto_anexos(projeto_id);

create table classificacoes_manutencao (
    id uuid primary key default gen_random_uuid(),
    nome text not null unique,
    cor text,
    icone_url text,
    criado_em timestamptz not null default now()
);

create table tarefas_manutencao (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    classificacao_id uuid references classificacoes_manutencao(id) on delete set null,
    frequencia_dias integer not null check (frequencia_dias > 0),
    ultima_execucao date,
    ativo boolean not null default true,
    criado_em timestamptz not null default now()
);

create index idx_tarefas_manutencao_classificacao on tarefas_manutencao(classificacao_id);

create table tarefas_manutencao_historico (
    id uuid primary key default gen_random_uuid(),
    tarefa_id uuid not null references tarefas_manutencao(id) on delete cascade,
    data_execucao date not null,
    observacao text,
    criado_em timestamptz not null default now()
);

create index idx_tarefas_manutencao_historico_tarefa on tarefas_manutencao_historico(tarefa_id, data_execucao);
