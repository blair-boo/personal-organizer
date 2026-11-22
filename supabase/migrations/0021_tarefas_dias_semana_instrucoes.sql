-- Dias da semana (0 = segunda ... 6 = domingo) e instruções das tarefas de manutenção.
-- Os dias só organizam e filtram (kanban e filtro por dia); a próxima execução
-- continua contada pela frequência.
alter table tarefas_manutencao
    add column dias_semana smallint[] not null default '{}',
    add column instrucoes text;

alter table tarefas_manutencao
    add constraint tarefas_dias_semana_validos check (dias_semana <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);
