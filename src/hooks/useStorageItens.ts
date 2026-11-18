import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { ItemStorage } from '../types';

/** Todos os itens de todas as caixas (poucos dados; uma consulta só facilita a busca e o uso offline). */
export function useStorageItens() {
  return useQuery({
    queryKey: ['storage_itens'],
    queryFn: async () => {
      const { data, error } = await supabase.from('storage_itens').select('*').order('ordem').order('nome');
      if (error) throw error;
      return data as ItemStorage[];
    },
  });
}
