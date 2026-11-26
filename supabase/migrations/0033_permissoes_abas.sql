-- Permissões por aba (Settings > Usuários): o que cada login pode ver e editar.
-- Sem linha = não vê e não edita (padrão). Admin ignora esta tabela e vê e edita tudo.
-- A chave da aba é a de src/lib/abas.ts (ex.: 'principal:financas', 'financas:resumo').
-- ATENÇÃO: por enquanto valem só na interface do app. As policies das demais tabelas continuam
-- abertas a qualquer login autenticado (aplicar no banco está no backlog, junto com Finanças pessoais).

create table usuarios_abas_permissoes (
    usuario_id uuid not null references auth.users(id) on delete cascade,
    aba_chave text not null,
    ver boolean not null default false,
    editar boolean not null default false,
    primary key (usuario_id, aba_chave),
    constraint editar_exige_ver check (not editar or ver)
);

alter table usuarios_abas_permissoes enable row level security;

-- Cada um lê as próprias permissões; o admin lê as de todos.
create policy "permissoes_abas_leitura" on usuarios_abas_permissoes
    for select to authenticated using (usuario_id = auth.uid() or eh_admin());

-- Só admin altera.
create policy "permissoes_abas_escrita_admin" on usuarios_abas_permissoes
    for all to authenticated using (eh_admin()) with check (eh_admin());
