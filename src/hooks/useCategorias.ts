import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { Categoria, TipoCategoria } from '../types';

export function useCategorias(tipo: TipoCategoria) {
  return useQuery({
    queryKey: ['categorias', tipo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('tipo', tipo)
        .order('ordem')
        .order('nome');
      if (error) throw error;
      return data as Categoria[];
    },
  });
}

export function useCriarCategoria(tipo: TipoCategoria) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nome, parentId }: { nome: string; parentId: string | null }) => {
      const { error } = await supabase.from('categorias').insert({ nome, tipo, parent_id: parentId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categorias', tipo] }),
  });
}

export function useRenomearCategoria(tipo: TipoCategoria) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from('categorias').update({ nome }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categorias', tipo] }),
  });
}

/** Quantos lançamentos usam cada categoria, pra mostrar o selinho de contagem (ex.: Genres/Tags do manga-lists). */
export function useUsoCategorias() {
  return useQuery({
    queryKey: ['categorias', 'uso'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lancamentos').select('categoria_id').not('categoria_id', 'is', null);
      if (error) throw error;
      const mapa = new Map<string, number>();
      for (const linha of data as { categoria_id: string }[]) {
        mapa.set(linha.categoria_id, (mapa.get(linha.categoria_id) ?? 0) + 1);
      }
      return mapa;
    },
  });
}

export function useExcluirCategoria(tipo: TipoCategoria) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categorias').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categorias', tipo] }),
  });
}
