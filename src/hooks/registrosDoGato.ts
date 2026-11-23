import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

/**
 * Peças comuns dos históricos de cada gato (vacinas, vermífugo, consultas,
 * exames e peso): uma consulta com as linhas de todos os gatos (poucas, e assim
 * a aba abre inteira sem internet) e as gravações de incluir, trocar e excluir.
 * Cada entidade tem o seu arquivo, com os tipos próprios.
 */
export function criarHooksDeRegistros<T extends { id: string }, Dados extends object>(tabela: string, ordenarPor = 'data') {
  function useLista() {
    return useQuery({
      queryKey: [tabela],
      queryFn: async () => {
        const { data, error } = await supabase.from(tabela).select('*').order(ordenarPor, { ascending: false });
        if (error) throw error;
        return data as T[];
      },
    });
  }

  function useIncluir() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (dados: Dados & { id?: string }) => {
        const { error } = await supabase.from(tabela).insert(dados);
        if (error) throw error;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: [tabela] }),
    });
  }

  function useAtualizar() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async ({ id, dados }: { id: string; dados: Partial<Dados> }) => {
        const { error } = await supabase.from(tabela).update(dados as Record<string, unknown>).eq('id', id);
        if (error) throw error;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: [tabela] }),
    });
  }

  function useExcluir() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from(tabela).delete().eq('id', id);
        if (error) throw error;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: [tabela] }),
    });
  }

  return { useLista, useIncluir, useAtualizar, useExcluir };
}
