-- Adiar ou pular uma tarefa: adiada_ate substitui a próxima execução calculada
-- até a tarefa ser feita de novo (aí volta a valer o cálculo pela frequência).
alter table tarefas_manutencao add column adiada_ate date;

-- Foto de cada gato (arquivo no bucket privado `confidencial`, subpasta gatos/).
alter table gatos add column foto_url text;
