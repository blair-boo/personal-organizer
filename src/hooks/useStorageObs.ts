import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { ObsStorage } from '../types';

/** Observações de todos os itens, na ordem em que foram escritas. */
export function useStorageObs() {
  return useQuery({
    queryKey: ['storage_obs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('storage_obs').select('*').order('ordem');
      if (error) throw error;
      return data as ObsStorage[];
    },
  });
}
