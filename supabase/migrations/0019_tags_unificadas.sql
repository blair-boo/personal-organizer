-- As tarefas de manutenção passam a usar as mesmas tags (cômodos) dos itens de
-- Apartamento e do Storage (tags_itens). A tabela classificacoes_tarefas, que
-- tinha os mesmos nomes numa lista separada, deixa de existir.

-- Toda classificação existente vira tag, se ainda não houver uma com o mesmo nome.
insert into tags_itens (nome)
select c.nome from classificacoes_tarefas c
where not exists (select 1 from tags_itens t where t.nome = c.nome);

alter table tarefa_classificacoes add column tag_id uuid references tags_itens(id) on delete cascade;

update tarefa_classificacoes tc
set tag_id = t.id
from classificacoes_tarefas c
join tags_itens t on t.nome = c.nome
where c.id = tc.classificacao_id;

alter table tarefa_classificacoes drop constraint tarefa_classificacoes_pkey;
alter table tarefa_classificacoes drop column classificacao_id;
alter table tarefa_classificacoes alter column tag_id set not null;
alter table tarefa_classificacoes add primary key (tarefa_id, tag_id);

drop table classificacoes_tarefas;
