-- Importação de extrato/fatura, lançamentos e o "banco de lançamentos" (memória de categorização).
create table importacoes (
    id uuid primary key default gen_random_uuid(),
    conta_id uuid not null references contas(id) on delete cascade,
    competencia date not null,
    nome_arquivo text,
    arquivo_url text,
    status text not null default 'revisao' check (status in ('revisao', 'concluida')),
    criado_em timestamptz not null default now()
);

create index idx_importacoes_conta_competencia on importacoes(conta_id, competencia);

create table lancamentos (
    id uuid primary key default gen_random_uuid(),
    conta_id uuid not null references contas(id) on delete cascade,
    importacao_id uuid references importacoes(id) on delete set null,
    data date not null,
    descricao_original text not null,
    descricao_normalizada text not null,
    valor numeric(12, 2) not null,
    tipo text not null check (tipo in ('entrada', 'saida')),
    categoria_id uuid references categorias(id) on delete set null,
    parcela_atual integer,
    parcela_total integer,
    observacao text,
    criado_em timestamptz not null default now()
);

create index idx_lancamentos_conta_data on lancamentos(conta_id, data);
create index idx_lancamentos_categoria on lancamentos(categoria_id);
create index idx_lancamentos_descricao_normalizada on lancamentos(descricao_normalizada);

create table regras_categorizacao (
    id uuid primary key default gen_random_uuid(),
    descricao_normalizada text not null unique,
    categoria_id uuid not null references categorias(id) on delete cascade,
    ultima_utilizacao timestamptz not null default now(),
    criado_em timestamptz not null default now()
);
