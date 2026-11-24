-- Ícones das funções Voltar, Avançar e Subir ao topo. Sem máscara (cores originais dos PNGs).
-- Apontam para a pasta `Simples`; a migração automática da aba Settings > Ícones copia para `em-uso`.
insert into icones_usos (alvo_tipo, alvo_id, icone_pasta, icone_arquivo, mascara, cor_origem, cor_valor, tamanho_delta, tema)
values
  ('funcao', 'voltar', 'Simples', 'UI_Icon_UGC_StepUndo.png', false, 'padrao', null, 0, 'ambos'),
  ('funcao', 'avancar', 'Simples', 'UI_Icon_UGC_StepRedo.png', false, 'padrao', null, 0, 'ambos'),
  ('funcao', 'topo', 'Simples', 'UI_Img_ThemeParkSim_SideBg_LeveUp.png', false, 'padrao', null, 0, 'ambos')
on conflict (alvo_tipo, alvo_id, tema) do update
  set icone_pasta = excluded.icone_pasta,
      icone_arquivo = excluded.icone_arquivo,
      mascara = excluded.mascara,
      cor_origem = excluded.cor_origem,
      cor_valor = excluded.cor_valor,
      tamanho_delta = excluded.tamanho_delta;
