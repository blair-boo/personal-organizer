import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { chavesDaTabela, permissaoDe, podeEditarAba, podeVerAba, type Permissoes } from '../lib/permissoesAbas';
import type { Perfil } from '../types';

/** O perfil de quem está usando o app (papel). Fica guardado no aparelho para o app abrir offline. */
export function useMeuPerfil() {
  const { session } = useAuth();
  const meuId = session?.user.id;
  return useQuery({
    queryKey: ['meu_perfil', meuId],
    enabled: !!meuId,
    queryFn: async () => {
      const { data, error } = await supabase.from('perfis').select('*').eq('usuario_id', meuId!).maybeSingle();
      if (error) throw error;
      return data as Perfil | null;
    },
  });
}

/** Permissões por aba de um login (Settings > Usuários, para o admin; e as de quem está usando o app). */
export function usePermissoesDoUsuario(usuarioId: string | undefined) {
  return useQuery({
    queryKey: ['permissoes_abas', usuarioId],
    enabled: !!usuarioId,
    queryFn: async (): Promise<Permissoes> => {
      const { data, error } = await supabase.from('usuarios_abas_permissoes').select('aba_chave, ver, editar').eq('usuario_id', usuarioId!);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((l) => [l.aba_chave as string, { ver: l.ver as boolean, editar: l.editar as boolean }]));
    },
  });
}

export interface EstadoPermissoes {
  /** Perfil e permissões já carregados. Enquanto não, nada é liberado. */
  pronto: boolean;
  erro: boolean;
  admin: boolean;
  permissoes: Permissoes;
  podeVer: (chave: string) => boolean;
  podeEditar: (chave: string) => boolean;
}

/** O que quem está usando o app pode ver e editar. Admin vê e edita tudo. */
export function usePermissoes(): EstadoPermissoes {
  const { session } = useAuth();
  const perfil = useMeuPerfil();
  const permissoes = usePermissoesDoUsuario(session?.user.id);
  const admin = perfil.data?.papel === 'admin';
  const pronto = perfil.isSuccess && permissoes.isSuccess;
  const erro = (perfil.isError && !perfil.data) || (permissoes.isError && !permissoes.data);
  const dados = permissoes.data;
  return useMemo(() => {
    const mapa = dados ?? {};
    return {
      pronto,
      erro,
      admin,
      permissoes: mapa,
      podeVer: (chave: string) => pronto && podeVerAba(mapa, admin, chave),
      podeEditar: (chave: string) => pronto && podeEditarAba(mapa, admin, chave),
    };
  }, [pronto, erro, admin, dados]);
}

/** Grava a tabela inteira de permissões de um login (admin). Aba fora da tabela (Usuários) nunca é gravada. */
export function useSalvarPermissoes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ usuarioId, permissoes }: { usuarioId: string; permissoes: Permissoes }) => {
      const linhas = chavesDaTabela().map((chave) => ({ usuario_id: usuarioId, aba_chave: chave, ...permissaoDe(permissoes, chave) }));
      const { error } = await supabase.from('usuarios_abas_permissoes').upsert(linhas, { onConflict: 'usuario_id,aba_chave' });
      if (error) throw error;
    },
    onSuccess: (_resultado, { usuarioId }) => qc.invalidateQueries({ queryKey: ['permissoes_abas', usuarioId] }),
  });
}
