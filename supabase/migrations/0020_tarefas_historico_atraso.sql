-- Histórico de execuções com atraso: cada execução guarda a data em que deveria
-- ter sido feita (data_prevista) e de onde conta a próxima (base_proxima):
-- 'execucao' = a partir do dia em que foi feita, 'prevista' = volta ao ciclo original.
-- A tarefa guarda a data-base atual (proxima_a_partir_de); sem ela, vale ultima_execucao.
alter table tarefas_manutencao_historico
    add column data_prevista date,
    add column base_proxima text not null default 'execucao' check (base_proxima in ('execucao', 'prevista'));

alter table tarefas_manutencao add column proxima_a_partir_de date;
