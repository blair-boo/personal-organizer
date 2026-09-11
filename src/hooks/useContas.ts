import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { Conta, TipoConta } from '../types';

const QUERY_KEY = ['contas'];

export function useContas() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('contas').select('*').order('nome');
      if (error) throw error;
      return data as Conta[];
    },
  });
}

export interface DadosConta {
  nome: string;
  tipo: TipoConta;
  instituicao: string;
  cor: string | null;
  ativo: boolean;
}

export function useCriarConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dados: DadosConta) => {
      const { error } = await supabase.from('contas').insert(dados);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useAtualizarConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: DadosConta }) => {
      const { error } = await supabase.from('contas').update(dados).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useExcluirConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
