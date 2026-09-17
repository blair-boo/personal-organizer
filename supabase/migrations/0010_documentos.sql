-- Aba Documentos: guarda documentos pessoais confidenciais (Pessoais) e
-- documentos livres de outras áreas (Apartamento/Arquivo/Outros) numa única
-- tabela, com campos fixos só preenchidos quando area = 'pessoais'.
create table documentos (
    id uuid primary key default gen_random_uuid(),
    area text not null check (area in ('pessoais', 'apartamento', 'arquivo', 'outros')),
    pessoa text check (pessoa in ('mariana', 'casal')),
    titulo text not null,
    ordem integer not null default 0,
    numero text,
    numero_espelho text,
    emissao date,
    vencimento_tipo text check (vencimento_tipo in ('data', 'prazo', 'indeterminado')),
    vencimento_data date,
    vencimento_quantidade integer check (vencimento_quantidade is null or vencimento_quantidade > 0),
    vencimento_unidade text check (vencimento_unidade in ('dias', 'meses', 'anos')),
    vencimento_calculada date,
    aviso_vencimento boolean not null default false,
    aviso_dias integer check (aviso_dias is null or aviso_dias > 0),
    renovar_tipo text check (renovar_tipo in ('online', 'presencial', 'ambos')),
    renovar_site_nome text,
    renovar_site_link text,
    criado_em timestamptz not null default now(),
    constraint pessoa_obrigatoria_se_pessoais check (area <> 'pessoais' or pessoa is not null)
);

create index idx_documentos_area on documentos(area, pessoa);

-- Campos livres (nome/conteúdo), usados pelo Padrão A genérico das áreas
-- Apartamento/Arquivo/Outros.
create table documentos_campos (
    id uuid primary key default gen_random_uuid(),
    documento_id uuid not null references documentos(id) on delete cascade,
    nome text not null,
    conteudo text,
    copiavel boolean not null default true,
    ordem integer not null default 0
);

create index idx_documentos_campos_documento on documentos_campos(documento_id);

-- Locais de renovação presencial (Documentos Pessoais): pode ter mais de um.
create table documentos_locais_renovacao (
    id uuid primary key default gen_random_uuid(),
    documento_id uuid not null references documentos(id) on delete cascade,
    local text,
    endereco text,
    telefone text,
    ordem integer not null default 0
);

create index idx_documentos_locais_documento on documentos_locais_renovacao(documento_id);

create table documentos_anexos (
    id uuid primary key default gen_random_uuid(),
    documento_id uuid not null references documentos(id) on delete cascade,
    nome text not null,
    arquivo_url text not null,
    nome_arquivo text not null,
    criado_em timestamptz not null default now()
);

create index idx_documentos_anexos_documento on documentos_anexos(documento_id);

-- RLS: mesmo padrão do resto do app (app de usuário único, só exige login).
alter table documentos enable row level security;
alter table documentos_campos enable row level security;
alter table documentos_locais_renovacao enable row level security;
alter table documentos_anexos enable row level security;

create policy "authenticated_full_access_documentos" on documentos
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_documentos_campos" on documentos_campos
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_documentos_locais_renovacao" on documentos_locais_renovacao
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_documentos_anexos" on documentos_anexos
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Bucket para documentos pessoais confidenciais (CPF, passaporte, certidões
-- etc.). Fica SEMPRE privado — nunca repetir aqui o que 0009 fez com o
-- bucket `icones` (torná-lo público). Se algum dia alguém for mexer nesta
-- migration, isso é intencional e não deve ser "corrigido".
insert into storage.buckets (id, name, public)
values ('confidencial', 'confidencial', false)
on conflict (id) do nothing;

create policy "authenticated_full_access_confidencial" on storage.objects
    for all using (bucket_id = 'confidencial' and auth.role() = 'authenticated')
    with check (bucket_id = 'confidencial' and auth.role() = 'authenticated');

-- Seed: documentos pessoais pré-criados, sem nenhum preenchimento.
insert into documentos (area, pessoa, titulo, ordem) values
    ('pessoais', 'mariana', 'Certidão de Nascimento', 1),
    ('pessoais', 'mariana', 'Carteira de Identidade Nacional (CIN)', 2),
    ('pessoais', 'mariana', 'CPF (Cadastro de Pessoas Físicas)', 3),
    ('pessoais', 'mariana', 'Título de Eleitor', 4),
    ('pessoais', 'mariana', 'CNH (Carteira Nacional de Habilitação)', 5),
    ('pessoais', 'mariana', 'Carteira de Trabalho (CTPS)', 6),
    ('pessoais', 'mariana', 'Passaporte', 7),
    ('pessoais', 'casal', 'Certidão de Casamento', 1),
    ('pessoais', 'casal', 'Escritura Pública de Pacto Antenupcial', 2),
    ('pessoais', 'casal', 'Certidão de Registro do Pacto Antenupcial', 3);
