import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { hojeIso } from '../lib/datas';
import type { TarefaManutencao } from '../types';

const QUERY_KEY = ['tarefas_manutencao'];

export interface DadosTarefaManutencao {
  nome: string;
  classificacao_id: string | null;
  frequencia_dias: number;
  ativo: boolean;
}

export function useTarefasManutencao() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('tarefas_manutencao').select('*').order('nome');
      if (error) throw error;
      return data as TarefaManutencao[];
    },
  });
}

export function useCriarTarefaManutencao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dados: DadosTarefaManutencao) => {
      const { error } = await supabase.from('tarefas_manutencao').insert(dados);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useAtualizarTarefaManutencao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: DadosTarefaManutencao }) => {
      const { error } = await supabase.from('tarefas_manutencao').update(dados).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useExcluirTarefaManutencao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tarefas_manutencao').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

/** Marca a tarefa como feita hoje: grava no histórico e atualiza `ultima_execucao`. */
export function useRegistrarExecucaoTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tarefaId, observacao }: { tarefaId: string; observacao?: string }) => {
      const hoje = hojeIso();
      const { error: erroHistorico } = await supabase
        .from('tarefas_manutencao_historico')
        .insert({ tarefa_id: tarefaId, data_execucao: hoje, observacao: observacao ?? null });
      if (erroHistorico) throw erroHistorico;
      const { error: erroTarefa } = await supabase
        .from('tarefas_manutencao')
        .update({ ultima_execucao: hoje })
        .eq('id', tarefaId);
      if (erroTarefa) throw erroTarefa;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
