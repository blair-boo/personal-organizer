import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { BackupStatus } from '../types';

/** Resumo do último backup (tabela backup_status, linha única). Nulo = nenhum backup registrado ainda. */
export function useBackupStatus() {
  return useQuery({
    queryKey: ['backup_status'],
    queryFn: async (): Promise<BackupStatus | null> => {
      const { data, error } = await supabase.from('backup_status').select('*').eq('id', 1).maybeSingle();
      if (error) throw error;
      return (data as BackupStatus | null) ?? null;
    },
  });
}
