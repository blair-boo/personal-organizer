import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabaseClient';
import type { PapelUsuario, Perfil } from '../types';

/** Logins do app (Settings > Usuários). Não fica guardado para uso offline. */
export function usePerfis() {
  return useQuery({
    queryKey: ['perfis'],
    queryFn: async () => {
      const { data, error } = await supabase.from('perfis').select('*').order('criado_em');
      if (error) throw error;
      return data as Perfil[];
    },
  });
}

/** Quem está usando o app é admin? Falso enquanto os perfis não carregam. */
export function useEhAdmin(): boolean {
  const { session } = useAuth();
  const { data: perfis } = usePerfis();
  const meuId = session?.user.id;
  return !!meuId && !!perfis?.some((p) => p.usuario_id === meuId && p.papel === 'admin');
}

export function useAlterarPapel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ usuarioId, papel }: { usuarioId: string; papel: PapelUsuario }) => {
      const { error } = await supabase.from('perfis').update({ papel }).eq('usuario_id', usuarioId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perfis'] }),
  });
}

/** Liga o login a uma pessoa (ou desliga, com null). Uma pessoa só tem um login, e um login só uma pessoa. */
export function useVincularPessoa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ usuarioId, pessoaId }: { usuarioId: string; pessoaId: string | null }) => {
      const { error: erroLimpar } = await supabase.from('documentos_pessoas').update({ usuario_id: null }).eq('usuario_id', usuarioId);
      if (erroLimpar) throw erroLimpar;
      if (!pessoaId) return;
      const { error } = await supabase.from('documentos_pessoas').update({ usuario_id: usuarioId }).eq('id', pessoaId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documentos_pessoas'] }),
  });
}

/** Troca o e-mail do próprio login. O Supabase manda um link de confirmação para o endereço novo; só depois ele vale. */
export function useTrocarEmail() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` });
      if (error) throw error;
    },
  });
}

export interface ResultadoConvite {
  /** true: o e-mail foi enviado. false: não deu para enviar e `link` leva o acesso, para mandar por outro meio. */
  enviado: boolean;
  link?: string;
  motivo?: string;
}

async function chamarGerenciarUsuarios<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('gerenciar-usuarios', { body: corpo });
  if (error) {
    // Erro HTTP da função: a mensagem útil vem no corpo da resposta.
    const resposta = (error as { context?: Response }).context;
    const detalhe = resposta ? await resposta.json().catch(() => null) : null;
    throw new Error((detalhe as { erro?: string } | null)?.erro ?? error.message);
  }
  if (data?.erro) throw new Error(data.erro as string);
  return data as T;
}

/** Cria o login e manda o convite. O perfil já aparece na lista antes de a pessoa aceitar. */
export function useConvidarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) =>
      chamarGerenciarUsuarios<ResultadoConvite>({ acao: 'convidar', email, redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perfis'] }),
  });
}

/** Apaga o login. A pessoa cadastrada em Documentos continua, só fica sem login. */
export function useExcluirUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (usuarioId: string) => chamarGerenciarUsuarios<{ ok: true }>({ acao: 'excluir', usuarioId }),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['perfis'] }), qc.invalidateQueries({ queryKey: ['documentos_pessoas'] })]),
  });
}
