import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabaseClient';
import type { FinancasAcesso, NivelAcessoFinancas } from '../types';

/**
 * Acessos às finanças que eu concedi (dono_id = eu) e os que recebi (convidado_id = eu).
 * A RLS só devolve linhas em que eu sou uma das pontas.
 */
export function useFinancasAcessos() {
  const meuId = useAuth().session?.user.id;
  return useQuery({
    queryKey: ['financas_acessos', meuId],
    enabled: !!meuId,
    queryFn: async () => {
      const { data, error } = await supabase.from('financas_acessos').select('dono_id, convidado_id, nivel');
      if (error) throw error;
      return data as FinancasAcesso[];
    },
  });
}

/** Libera (ver ou editar) ou revoga (nivel null) o acesso de um login às minhas finanças. */
export function useDefinirAcessoFinancas() {
  const qc = useQueryClient();
  const meuId = useAuth().session?.user.id;
  return useMutation({
    mutationFn: async ({ convidadoId, nivel }: { convidadoId: string; nivel: NivelAcessoFinancas | null }) => {
      if (!meuId) throw new Error('Sessão expirada. Entre de novo.');
      if (nivel === null) {
        const { error } = await supabase.from('financas_acessos').delete().eq('dono_id', meuId).eq('convidado_id', convidadoId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from('financas_acessos')
        .upsert({ dono_id: meuId, convidado_id: convidadoId, nivel }, { onConflict: 'dono_id,convidado_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financas_acessos'] }),
  });
}
