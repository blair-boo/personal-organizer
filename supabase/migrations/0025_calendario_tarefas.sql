-- Links de calendário (.ics) podem trazer também as próximas tarefas de manutenção.
alter table documentos_calendario_feeds add column incluir_tarefas boolean not null default false;
