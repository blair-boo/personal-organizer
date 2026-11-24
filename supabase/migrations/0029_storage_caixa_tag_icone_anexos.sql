-- Storage: tag principal da caixa, anexos da caixa inteira e ícone por caixa.

-- Tag principal da caixa (as mesmas tags/cômodos dos itens). Item sem tag própria segue esta tag.
alter table storage add column tag_id uuid references tags_itens(id) on delete set null;
create index idx_storage_tag on storage(tag_id);

-- Anexos da caixa inteira (arquivos no bucket confidencial, subpasta storage/caixas/{caixaId}/).
create table storage_caixa_anexos (
    id uuid primary key default gen_random_uuid(),
    storage_id uuid not null references storage(id) on delete cascade,
    nome text not null,
    arquivo_url text not null,
    nome_arquivo text not null,
    criado_em timestamptz not null default now()
);

create index idx_storage_caixa_anexos_caixa on storage_caixa_anexos(storage_id);

alter table storage_caixa_anexos enable row level security;
create policy "authenticated_full_access_storage_caixa_anexos" on storage_caixa_anexos
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Ícone por caixa: usa icones_usos, como categorias, abas e pessoas.
alter table icones_usos drop constraint icones_usos_alvo_tipo_check;
alter table icones_usos add constraint icones_usos_alvo_tipo_check check (alvo_tipo in ('funcao', 'categoria', 'aba', 'pessoa', 'caixa'));

-- Caixa excluída leva o uso de ícone junto (alvo_id é texto, sem FK).
create function remover_uso_icone_caixa() returns trigger
language plpgsql as $$
begin
    delete from icones_usos where alvo_tipo = 'caixa' and alvo_id = old.id::text;
    return old;
end;
$$;

create trigger storage_remover_uso_icone
    after delete on storage
    for each row execute function remover_uso_icone_caixa();
