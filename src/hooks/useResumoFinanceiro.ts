import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabaseClient';
import type { Lancamento } from '../types';

/** Todos os lançamentos que eu posso ver, de qualquer conta, com data entre inicioIso e fimIso, inclusive. O escopo filtra depois, em `lancamentosDoEscopo`. */
export function useLancamentosPeriodo(inicioIso: string, fimIso: string) {
  const meuId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['lancamentos_periodo', meuId, inicioIso, fimIso],
    enabled: !!meuId,
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
  const meuId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['lancamentos_parcelados', meuId],
    enabled: !!meuId,
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
