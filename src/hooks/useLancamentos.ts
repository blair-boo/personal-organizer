import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { Lancamento, TipoLancamento } from '../types';

export interface DadosLancamento {
  conta_id: string;
  importacao_id: string | null;
  data: string;
  descricao_original: string;
  descricao_normalizada: string;
  valor: number;
  tipo: TipoLancamento;
  categoria_id: string | null;
  parcela_atual: number | null;
  parcela_total: number | null;
  observacao: string | null;
}

function queryKey(contaId: string, competencia: string) {
  return ['lancamentos', contaId, competencia];
}

export function useLancamentosDoMes(contaId: string | null, competencia: string) {
  return useQuery({
    queryKey: contaId ? queryKey(contaId, competencia) : ['lancamentos', 'sem-conta'],
    enabled: !!contaId,
    queryFn: async () => {
      const inicio = `${competencia}-01`;
      const fim = `${competencia}-31`;
      const { data, error } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('conta_id', contaId as string)
        .gte('data', inicio)
        .lte('data', fim)
        .order('data');
      if (error) throw error;
      return data as Lancamento[];
    },
  });
}

export function useCriarLancamentosEmLote(contaId: string, competencia: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lancamentos: DadosLancamento[]) => {
      if (lancamentos.length === 0) return;
      const { error } = await supabase.from('lancamentos').insert(lancamentos);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(contaId, competencia) }),
  });
}

export function useCriarLancamento(contaId: string, competencia: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dados: DadosLancamento) => {
      const { error } = await supabase.from('lancamentos').insert(dados);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(contaId, competencia) }),
  });
}

export function useAtualizarLancamento(contaId: string, competencia: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<DadosLancamento> }) => {
      const { error } = await supabase.from('lancamentos').update(dados).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(contaId, competencia) }),
  });
}

export function useExcluirLancamento(contaId: string, competencia: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lancamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(contaId, competencia) }),
  });
}
