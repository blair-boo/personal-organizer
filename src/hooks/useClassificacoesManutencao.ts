import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { ClassificacaoManutencao } from '../types';

const QUERY_KEY = ['classificacoes_manutencao'];

export function useClassificacoesManutencao() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('classificacoes_manutencao').select('*').order('nome');
      if (error) throw error;
      return data as ClassificacaoManutencao[];
    },
  });
}

export function useCriarClassificacaoManutencao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nome, cor }: { nome: string; cor: string | null }) => {
      const { error } = await supabase.from('classificacoes_manutencao').insert({ nome, cor });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useRenomearClassificacaoManutencao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from('classificacoes_manutencao').update({ nome }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useExcluirClassificacaoManutencao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('classificacoes_manutencao').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
