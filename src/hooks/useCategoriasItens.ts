import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { CategoriaItens } from '../types';

const QUERY_KEY = ['categorias_itens'];

export function useCategoriasItens() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('categorias_itens').select('*').order('ordem').order('nome');
      if (error) throw error;
      return data as CategoriaItens[];
    },
  });
}

export function useCriarCategoriaItens() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nome, parentId }: { nome: string; parentId: string | null }) => {
      const { error } = await supabase.from('categorias_itens').insert({ nome, parent_id: parentId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useRenomearCategoriaItens() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from('categorias_itens').update({ nome }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useExcluirCategoriaItens() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categorias_itens').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
