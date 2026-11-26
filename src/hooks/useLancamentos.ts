import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { ultimoDiaDaCompetencia } from '../lib/datas';
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
  /** Despesa dividida com outra pessoa (só saídas). Quem pagou (pagador_id) o banco preenche. */
  conjunto?: boolean;
  conjunto_com?: string | null;
  divisao_percentual?: number;
}

/** O id de quem está logado entra na chave: o que fica guardado no aparelho nunca se mistura entre logins. */
function queryKey(meuId: string | undefined, contaId: string, competencia: string) {
  return ['lancamentos', meuId, contaId, competencia];
}

export function useLancamentosDoMes(contaId: string | null, competencia: string) {
  const meuId = useAuth().session?.user.id;
  return useQuery({
    queryKey: contaId ? queryKey(meuId, contaId, competencia) : ['lancamentos', meuId, 'sem-conta'],
    enabled: !!contaId,
    queryFn: async () => {
      const inicio = `${competencia}-01`;
      const fim = ultimoDiaDaCompetencia(competencia);
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
  const meuId = useAuth().session?.user.id;
  return useMutation({
    mutationFn: async (lancamentos: DadosLancamento[]) => {
      if (lancamentos.length === 0) return;
      const { error } = await supabase.from('lancamentos').insert(lancamentos);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(meuId, contaId, competencia) }),
  });
}

export function useCriarLancamento(contaId: string, competencia: string) {
  const qc = useQueryClient();
  const meuId = useAuth().session?.user.id;
  return useMutation({
    mutationFn: async (dados: DadosLancamento) => {
      const { error } = await supabase.from('lancamentos').insert(dados);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(meuId, contaId, competencia) }),
  });
}

export function useAtualizarLancamento(contaId: string, competencia: string) {
  const qc = useQueryClient();
  const meuId = useAuth().session?.user.id;
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<DadosLancamento> }) => {
      const { error } = await supabase.from('lancamentos').update(dados).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(meuId, contaId, competencia) }),
  });
}

export function useExcluirLancamento(contaId: string, competencia: string) {
  const qc = useQueryClient();
  const meuId = useAuth().session?.user.id;
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lancamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(meuId, contaId, competencia) }),
  });
}
