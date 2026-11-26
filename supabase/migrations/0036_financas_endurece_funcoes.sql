-- Endurece as funções criadas em 0034 (apontado pelo get_advisors do Supabase):
--  * As funções de permissão só precisam rodar para quem está logado (as policies são to authenticated).
--  * Funções de trigger não devem ser chamáveis por RPC.
--  * contas_proteger_dono sem search_path fixo.

revoke execute on function tem_acesso_financas(uuid, boolean) from anon;
revoke execute on function pode_ver_conta(uuid) from anon;
revoke execute on function pode_editar_conta(uuid) from anon;
revoke execute on function participa_do_conjunto() from anon;
revoke execute on function conta_do_caminho(text) from anon;

revoke execute on function lancamentos_definir_pagador() from public, anon, authenticated;
revoke execute on function contas_atualizar_pagador() from public, anon, authenticated;

alter function contas_proteger_dono() set search_path = public;
