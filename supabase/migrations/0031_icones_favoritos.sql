-- Ícones favoritos da galeria (bucket `icones`): servem de filtro para achar os ícones mais usados.
-- O favorito é identificado pela pasta e pelo nome do arquivo ('' = arquivos soltos na raiz).
-- Se o arquivo for movido, renomeado ou apagado, o favorito deixa de aparecer (não há vínculo com o Storage).

create table icones_favoritos (
    pasta text not null default '',
    arquivo text not null,
    criado_em timestamptz not null default now(),
    primary key (pasta, arquivo)
);

alter table icones_favoritos enable row level security;

create policy "authenticated_full_access_icones_favoritos" on icones_favoritos
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
