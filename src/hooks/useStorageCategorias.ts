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

export interface EdicaoCategoriasStorage {
  ordens: { id: string; ordem: number }[];
  renomeacoes: { id: string; nome: string }[];
  exclusoes: string[];
}

/** Aplica de uma vez o que ficou pendente no modo de edição: nomes, ordem e exclusões. Os itens de uma classificação excluída ficam sem classificação (on delete set null). */
export function useAplicarEdicaoCategoriasStorage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ordens, renomeacoes, exclusoes }: EdicaoCategoriasStorage) => {
      const excluir = new Set(exclusoes);
      for (const { id, nome } of renomeacoes) {
        if (excluir.has(id)) continue;
        const { error } = await supabase.from('storage_categorias').update({ nome }).eq('id', id);
        if (error) throw error;
      }
      for (const { id, ordem } of ordens) {
        if (excluir.has(id)) continue;
        const { error } = await supabase.from('storage_categorias').update({ ordem }).eq('id', id);
        if (error) throw error;
      }
      if (exclusoes.length > 0) {
        const { error } = await supabase.from('storage_categorias').delete().in('id', exclusoes);
        if (error) throw error;
      }
    },
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['storage_categorias'] }), qc.invalidateQueries({ queryKey: ['storage_itens'] })]),
  });
}
