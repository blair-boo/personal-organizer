-- Tarefas: renomeia a aba (a chave estável acompanha a rota nova /apartamento/tarefas).
update abas_config set chave = 'apartamento:tarefas' where chave = 'apartamento:manutencao';
update abas_config set nome = 'Tarefas' where chave = 'apartamento:tarefas' and nome = 'Manutenção';
update icones_usos set alvo_id = 'apartamento:tarefas' where alvo_tipo = 'aba' and alvo_id = 'apartamento:manutencao';

-- Ícone de pessoa e de casal (Documentos > Pessoais): usa icones_usos, como categorias e abas.
alter table icones_usos drop constraint icones_usos_alvo_tipo_check;
alter table icones_usos add constraint icones_usos_alvo_tipo_check check (alvo_tipo in ('funcao', 'categoria', 'aba', 'pessoa'));

-- Pessoa ou casal excluído leva o uso de ícone junto (alvo_id é texto, sem FK).
create function remover_uso_icone_pessoa() returns trigger
language plpgsql as $$
begin
    delete from icones_usos where alvo_tipo = 'pessoa' and alvo_id = old.id::text;
    return old;
end;
$$;

create trigger documentos_pessoas_remover_uso_icone
    after delete on documentos_pessoas
    for each row execute function remover_uso_icone_pessoa();

-- Histórico de adiamentos: quem adiou (a pessoa ligada ao login), para quando e a observação.
-- A tarefa continua guardando só o adiamento vigente (adiada_ate).
create table tarefas_adiamentos (
    id uuid primary key default gen_random_uuid(),
    tarefa_id uuid not null references tarefas_manutencao(id) on delete cascade,
    tipo text not null check (tipo in ('adiada', 'pulada', 'cancelada')),
    data_anterior date,
    adiada_para date,
    pessoa_id uuid references documentos_pessoas(id) on delete set null,
    observacao text,
    criado_em timestamptz not null default now()
);

create index idx_tarefas_adiamentos_tarefa on tarefas_adiamentos(tarefa_id, criado_em);

alter table tarefas_adiamentos enable row level security;
create policy "authenticated_full_access_tarefas_adiamentos" on tarefas_adiamentos
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
