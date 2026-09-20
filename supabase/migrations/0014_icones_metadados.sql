-- Metadados dos ícones do bucket `icones` (só a ordem de exibição por
-- enquanto): Storage não tem coluna de ordem própria pra arquivos, então
-- .list() só ordena por nome. Mesmo padrão de `categorias.ordem`.
create table icones_metadados (
    id uuid primary key default gen_random_uuid(),
    pasta text not null default '',
    arquivo text not null,
    ordem integer not null default 0,
    criado_em timestamptz not null default now(),
    unique (pasta, arquivo)
);

alter table icones_metadados enable row level security;

create policy "authenticated_full_access_icones_metadados" on icones_metadados
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Backfill: uma linha por arquivo já existente no bucket, preservando a
-- ordem alfabética atual (mesma ordem que já aparecia antes dessa tabela
-- existir), pra não mudar nada visualmente pra quem já usa a aba.
insert into icones_metadados (pasta, arquivo, ordem)
select
  case when name like 'PNG/%' then 'PNG' else '' end,
  case when name like 'PNG/%' then substring(name from 5) else name end,
  row_number() over (
    partition by (case when name like 'PNG/%' then 'PNG' else '' end)
    order by name
  )
from storage.objects
where bucket_id = 'icones'
on conflict (pasta, arquivo) do nothing;
