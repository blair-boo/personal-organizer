import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { dataPrevistaParaNova, resumoDoHistorico } from '../lib/historicoTarefa';
import type { BaseProximaExecucao, HistoricoTarefa } from '../types';

const CHAVE = ['tarefas_manutencao_historico'];

function invalidar(qc: QueryClient) {
  return Promise.all([qc.invalidateQueries({ queryKey: CHAVE }), qc.invalidateQueries({ queryKey: ['tarefas_manutencao'] })]);
}

/** Todas as execuções de todas as tarefas (poucas linhas; uma consulta só serve a lista, o kanban e o uso offline). */
export function useHistoricoTarefas() {
  return useQuery({
    queryKey: CHAVE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tarefas_manutencao_historico')
        .select('*')
        .order('data_execucao', { ascending: false })
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return data as HistoricoTarefa[];
    },
  });
}

async function entradasDaTarefa(tarefaId: string): Promise<HistoricoTarefa[]> {
  const { data, error } = await supabase.from('tarefas_manutencao_historico').select('*').eq('tarefa_id', tarefaId);
  if (error) throw error;
  return data as HistoricoTarefa[];
}

/** Recalcula, a partir do histórico, a última execução e a data-base da próxima, e grava na tarefa. */
async function recalcularTarefa(tarefaId: string): Promise<void> {
  const resumo = resumoDoHistorico(await entradasDaTarefa(tarefaId));
  const { error } = await supabase.from('tarefas_manutencao').update(resumo).eq('id', tarefaId);
  if (error) throw error;
}

export interface RegistroDeExecucao {
  tarefaId: string;
  dataExecucao: string;
  /** Quando deveria ter sido feita; null = sem referência (nunca foi feita antes). */
  dataPrevista: string | null;
  base: BaseProximaExecucao;
}

/** Registra uma execução (hoje, pelo botão) e atualiza a tarefa. */
export function useRegistrarExecucaoTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tarefaId, dataExecucao, dataPrevista, base }: RegistroDeExecucao) => {
      const { error } = await supabase.from('tarefas_manutencao_historico').insert({
        tarefa_id: tarefaId,
        data_execucao: dataExecucao,
        data_prevista: dataPrevista,
        base_proxima: base,
      });
      if (error) throw error;
      await recalcularTarefa(tarefaId);
    },
    onSuccess: () => invalidar(qc),
  });
}

/** Inclui à mão uma execução em outra data; a data prevista sai da execução anterior a ela. */
export function useIncluirExecucaoTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tarefaId, dataExecucao, frequenciaDias }: { tarefaId: string; dataExecucao: string; frequenciaDias: number }) => {
      const prevista = dataPrevistaParaNova(await entradasDaTarefa(tarefaId), dataExecucao, frequenciaDias);
      const { error } = await supabase.from('tarefas_manutencao_historico').insert({
        tarefa_id: tarefaId,
        data_execucao: dataExecucao,
        data_prevista: prevista,
        base_proxima: 'execucao',
      });
      if (error) throw error;
      await recalcularTarefa(tarefaId);
    },
    onSuccess: () => invalidar(qc),
  });
}

/** Troca a data de uma execução ou a base da próxima (a partir da data feita / voltar à original). */
export function useAtualizarExecucaoTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tarefaId, dataExecucao, base }: { id: string; tarefaId: string; dataExecucao?: string; base?: BaseProximaExecucao }) => {
      const mudancas: Record<string, string> = {};
      if (dataExecucao) mudancas.data_execucao = dataExecucao;
      if (base) mudancas.base_proxima = base;
      const { error } = await supabase.from('tarefas_manutencao_historico').update(mudancas).eq('id', id);
      if (error) throw error;
      await recalcularTarefa(tarefaId);
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useExcluirExecucaoTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tarefaId }: { id: string; tarefaId: string }) => {
      const { error } = await supabase.from('tarefas_manutencao_historico').delete().eq('id', id);
      if (error) throw error;
      await recalcularTarefa(tarefaId);
    },
    onSuccess: () => invalidar(qc),
  });
}
