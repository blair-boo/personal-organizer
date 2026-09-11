-- Núcleo: extensão de UUID, contas (correntes/poupança/investimento/cartão) e categorias financeiras.
create extension if not exists pgcrypto;

create table contas (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    tipo text not null check (tipo in ('conta_corrente', 'conta_poupanca', 'conta_investimento', 'cartao_credito')),
    instituicao text not null,
    cor text,
    ativo boolean not null default true,
    criado_em timestamptz not null default now()
);

create table categorias (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    tipo text not null check (tipo in ('despesa', 'receita')),
    parent_id uuid references categorias(id) on delete cascade,
    cor text,
    icone_url text,
    ordem integer not null default 0,
    criado_em timestamptz not null default now(),
    unique (tipo, parent_id, nome)
);

create index idx_categorias_parent_id on categorias(parent_id);
