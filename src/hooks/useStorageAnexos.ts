import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { AnexoStorage } from '../types';

/** Fotos e anexos de todos os itens (bucket confidencial, subpasta storage). */
export function useStorageAnexos() {
  return useQuery({
    queryKey: ['storage_anexos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('storage_anexos').select('*').order('criado_em');
      if (error) throw error;
      return data as AnexoStorage[];
    },
  });
}
