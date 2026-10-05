import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { AbaConfig } from '../types';

const CHAVE = ['abas_config'];

export function useAbasConfig() {
  return useQuery({
    queryKey: CHAVE,
    queryFn: async (): Promise<AbaConfig[]> => {
      const { data, error } = await supabase.from('abas_config').select('chave, nome, ordem');
      if (error) throw error;
      return (data ?? []) as AbaConfig[];
    },
  });
}

export function useSalvarAbasConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (configs: AbaConfig[]) => {
      if (configs.length === 0) return;
      const { error } = await supabase.from('abas_config').upsert(configs, { onConflict: 'chave' });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CHAVE }),
  });
}
