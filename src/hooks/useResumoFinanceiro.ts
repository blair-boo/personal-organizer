import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { Lancamento } from '../types';

/** Todos os lançamentos (de qualquer conta) com data entre inicioIso e fimIso, inclusive. */
export function useLancamentosPeriodo(inicioIso: string, fimIso: string) {
  return useQuery({
    queryKey: ['lancamentos_periodo', inicioIso, fimIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos')
        .select('*')
        .gte('data', inicioIso)
        .lte('data', fimIso)
        .order('data');
      if (error) throw error;
      return data as Lancamento[];
    },
  });
}

/** Lançamentos parcelados (parcela_total preenchido), de qualquer período, pra agrupar por compra. */
export function useLancamentosParcelados() {
  return useQuery({
    queryKey: ['lancamentos_parcelados'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos')
        .select('*')
        .not('parcela_total', 'is', null)
        .order('data');
      if (error) throw error;
      return data as Lancamento[];
    },
  });
}
