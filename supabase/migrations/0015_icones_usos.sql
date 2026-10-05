-- Sistema de ícones configurável:
--  * icones_usos: qual ícone do bucket `icones` aparece em cada função (salvar,
--    editar...), categoria ou aba, com tamanho, máscara de cor e tema.
--  * abas_config: nome e ordem das abas (principais e sub-abas) editáveis.
--  * cores_usuario: "Minhas cores" do seletor de cor (antes só no localStorage).

create table icones_usos (
    id uuid primary key default gen_random_uuid(),
    -- 'funcao' (ícone de ação, vale para o app todo), 'categoria' ou 'aba' (ilustram um título).
    alvo_tipo text not null check (alvo_tipo in ('funcao', 'categoria', 'aba')),
    alvo_id text not null,
    icone_pasta text not null default '',
    icone_arquivo text not null,
    -- Diferença em px sobre o tamanho padrão do lugar (negativo = menor).
    tamanho_delta integer not null default 0,
    mascara boolean not null default true,
    -- 'padrao' = cor do lugar (currentColor); 'app' = variável CSS (cor_valor, ex.: --accent); 'minha' = hex salvo.
    cor_origem text not null default 'padrao' check (cor_origem in ('padrao', 'app', 'minha')),
    cor_valor text,
    tema text not null default 'ambos' check (tema in ('claro', 'escuro', 'ambos')),
    criado_em timestamptz not null default now(),
    unique (alvo_tipo, alvo_id, tema)
);

create table abas_config (
    chave text primary key,
    -- null = nome padrão do código; '' = só o ícone aparece.
    nome text,
    ordem integer not null default 0,
    criado_em timestamptz not null default now()
);

create table cores_usuario (
    id uuid primary key default gen_random_uuid(),
    hex text not null,
    label text not null default '',
    ordem integer not null default 0,
    criado_em timestamptz not null default now()
);

alter table icones_usos enable row level security;
alter table abas_config enable row level security;
alter table cores_usuario enable row level security;

create policy "authenticated_full_access_icones_usos" on icones_usos
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_abas_config" on abas_config
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_cores_usuario" on cores_usuario
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Categoria excluída leva o uso de ícone junto (alvo_id é texto, sem FK).
create function remover_uso_icone_categoria() returns trigger
language plpgsql as $$
begin
    delete from icones_usos where alvo_tipo = 'categoria' and alvo_id = old.id::text;
    return old;
end;
$$;

create trigger categorias_remover_uso_icone
    after delete on categorias
    for each row execute function remover_uso_icone_categoria();

-- Dados iniciais: vínculos que antes ficavam no mapa fixo de src/lib/iconesCategorias.ts
-- (só categorias raiz; onde havia mais de um candidato entra o primeiro).
insert into icones_usos (alvo_tipo, alvo_id, icone_pasta, icone_arquivo, mascara)
select 'categoria', c.id::text, 'PNG', m.arquivo, m.mascara
from categorias c
join (values
    ('Moradia', 'casa.png', false),
    ('Mercado', 'compras.png', true),
    ('Restaurantes', 'garfo-colher-placa.png', false),
    ('Transporte', 'taxi.png', true),
    ('Saúde', 'estetoscopio.png', true),
    ('Cuidados pessoais', 'face-mask.png', true),
    ('Compras', 'cabide2.png', false),
    ('Casa', 'cama.png', false),
    ('Educação', 'estante.png', false),
    ('Lazer', 'games3.png', false),
    ('Viagem', 'aviao.png', true),
    ('Assinaturas', 'compras-celular.png', true),
    ('Pets', 'gato.png', false),
    ('Tarifas e impostos', 'templo.png', false),
    ('Trabalho', 'martelo-juiz.png', true),
    ('Investimentos', 'saco2.png', false),
    ('Outros', 'mapa.png', false),
    ('Salário', 'bussola.png', false),
    ('Outros Rendimentos', 'ampulheta.png', false)
) as m(nome, arquivo, mascara) on c.nome = m.nome and c.parent_id is null
on conflict do nothing;
