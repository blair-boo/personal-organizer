import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { CategoriaStorage } from '../types';

/** Classificações dos itens das caixas (ex.: Cozinha, Ferramentas). */
export function useStorageCategorias() {
  return useQuery({
    queryKey: ['storage_categorias'],
    queryFn: async () => {
      const { data, error } = await supabase.from('storage_categorias').select('*').order('ordem').order('nome');
      if (error) throw error;
      return data as CategoriaStorage[];
    },
  });
}

export function useCriarCategoriaStorage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nome, ordem }: { nome: string; ordem: number }) => {
      const { data, error } = await supabase.from('storage_categorias').insert({ nome, ordem }).select().single();
      if (error) throw error;
      return data as CategoriaStorage;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['storage_categorias'] }),
  });
}
