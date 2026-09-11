import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { Projeto, StatusProjeto } from '../types';

const QUERY_KEY = ['projetos'];

export interface DadosProjeto {
  nome: string;
  descricao: string | null;
  status: StatusProjeto;
  data_inicio: string | null;
  data_conclusao: string | null;
}

export function useProjetos() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('projetos').select('*').order('criado_em', { ascending: false });
      if (error) throw error;
      return data as Projeto[];
    },
  });
}

export function useCriarProjeto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dados: DadosProjeto) => {
      const { data, error } = await supabase.from('projetos').insert(dados).select().single();
      if (error) throw error;
      return data as Projeto;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useAtualizarProjeto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: DadosProjeto }) => {
      const { error } = await supabase.from('projetos').update(dados).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useExcluirProjeto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projetos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
