-- Ícones das abas principais e dos botões de tema (claro, sistema, escuro).
-- Os que apontam para a pasta `Simples` são copiados para `em-uso` pela migração
-- automática da aba Settings > Ícones, na primeira vez que ela for aberta.
-- Todos sem máscara, para os PNGs aparecerem com as cores originais.
insert into icones_usos (alvo_tipo, alvo_id, icone_pasta, icone_arquivo, mascara, cor_origem, cor_valor, tamanho_delta, tema)
values
  ('aba', 'principal:hoje', 'Simples', 'Phone App_Navigation.png', false, 'padrao', null, 0, 'ambos'),
  ('aba', 'principal:financas', 'em-uso', 'Simples__UI_Icon_Activity_AlchemySim_Cash.png', false, 'padrao', null, 0, 'ambos'),
  ('aba', 'principal:apartamento', 'em-uso', 'PNG__templo.png', false, 'padrao', null, 0, 'ambos'),
  ('aba', 'principal:storage', 'Simples', 'UI_Icon_CharMaster_Box_02.png', false, 'padrao', null, 0, 'ambos'),
  ('aba', 'principal:documentos', 'Simples', 'Phone App_Account Settings.png', false, 'padrao', null, 0, 'ambos'),
  ('aba', 'principal:settings', 'Simples', 'UI_Icon_Intee_Questinference.png', false, 'padrao', null, 0, 'ambos'),
  ('funcao', 'tema_claro', 'Simples', 'UI_Icon_AutoChess_Type04.png', false, 'padrao', null, 0, 'ambos'),
  ('funcao', 'tema_sistema', 'Simples', 'UI_Icon_UGCToolBar_Performance.png', false, 'padrao', null, 0, 'ambos'),
  ('funcao', 'tema_escuro', 'Simples', 'UI_Img_MoonPhase_PatternM3_1.png', false, 'padrao', null, 0, 'ambos')
on conflict (alvo_tipo, alvo_id, tema) do update
  set icone_pasta = excluded.icone_pasta,
      icone_arquivo = excluded.icone_arquivo,
      mascara = excluded.mascara,
      cor_origem = excluded.cor_origem,
      cor_valor = excluded.cor_valor,
      tamanho_delta = excluded.tamanho_delta;
