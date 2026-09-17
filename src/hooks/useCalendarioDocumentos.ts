import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { CalendarioConfig } from '../types';

const QUERY_KEY = ['documentos_calendario_config'];

export function useCalendarioToken() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('documentos_calendario_config').select('token').eq('id', 1).single();
      if (error) throw error;
      return data as CalendarioConfig;
    },
  });
}

/** Troca o token secreto do feed, invalidando qualquer assinatura já feita com o link antigo. */
export function useGerarNovoTokenCalendario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const novoToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      const { error } = await supabase
        .from('documentos_calendario_config')
        .update({ token: novoToken, atualizado_em: new Date().toISOString() })
        .eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

/** Monta a URL pública do feed .ics (Edge Function `documentos-ics`) a partir do token atual. */
export function urlFeedCalendario(token: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  return `${base}/functions/v1/documentos-ics?token=${token}`;
}
