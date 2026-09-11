-- RLS: app single-user, só exige autenticação (mesmo padrão do manga-lists) — sem ownership por linha.
alter table contas enable row level security;
alter table categorias enable row level security;
alter table importacoes enable row level security;
alter table lancamentos enable row level security;
alter table regras_categorizacao enable row level security;
alter table categorias_itens enable row level security;
alter table itens enable row level security;
alter table item_documentos enable row level security;
alter table projetos enable row level security;
alter table projeto_anexos enable row level security;
alter table classificacoes_manutencao enable row level security;
alter table tarefas_manutencao enable row level security;
alter table tarefas_manutencao_historico enable row level security;

create policy "authenticated_full_access_contas" on contas
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_categorias" on categorias
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_importacoes" on importacoes
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_lancamentos" on lancamentos
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_regras_categorizacao" on regras_categorizacao
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_categorias_itens" on categorias_itens
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_itens" on itens
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_item_documentos" on item_documentos
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_projetos" on projetos
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_projeto_anexos" on projeto_anexos
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_classificacoes_manutencao" on classificacoes_manutencao
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_tarefas_manutencao" on tarefas_manutencao
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access_tarefas_manutencao_historico" on tarefas_manutencao_historico
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
