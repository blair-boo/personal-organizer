import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { dataPrevistaParaNova } from '../lib/historicoTarefa';
import { executarOuEnfileirar } from '../lib/offline/executarOuEnfileirar';
import { entradasDaTarefa } from '../lib/offline/executores';
import { contarFila } from '../lib/offline/fila';
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

export interface RegistroDeExecucao {
  tarefaId: string;
  dataExecucao: string;
  /** Quando deveria ter sido feita; null = sem referência (nunca foi feita antes). */
  dataPrevista: string | null;
  base: BaseProximaExecucao;
}

/** Se já foi para o servidor ou ficou na fila (sem internet, ou com alterações esperando); só no primeiro caso as consultas são buscadas de novo. */
function depois(qc: QueryClient) {
  return (resultado: 'enviada' | 'enfileirada') => (resultado === 'enviada' ? invalidar(qc) : undefined);
}

/** Registra uma execução (hoje, pelo botão) e atualiza a tarefa. Funciona sem internet. */
export function useRegistrarExecucaoTarefa() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: () => undefined,
    mutationFn: ({ tarefaId, dataExecucao, dataPrevista, base }: RegistroDeExecucao) =>
      executarOuEnfileirar(qc, 'manutencao.inserirExecucao', { id: crypto.randomUUID(), tarefaId, dataExecucao, dataPrevista, base }),
    onSuccess: depois(qc),
  });
}

/** Inclui à mão uma execução em outra data; a data prevista sai da execução anterior a ela. */
export function useIncluirExecucaoTarefa() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: () => undefined,
    mutationFn: async ({ tarefaId, dataExecucao, frequenciaDias }: { tarefaId: string; dataExecucao: string; frequenciaDias: number }) => {
      // Com a fila cheia ou sem internet, o servidor não tem tudo: usa o que está no aparelho.
      const usarAparelho = !navigator.onLine || (await contarFila()) > 0;
      const entradas = usarAparelho
        ? (qc.getQueryData<HistoricoTarefa[]>(CHAVE) ?? []).filter((e) => e.tarefa_id === tarefaId)
        : await entradasDaTarefa(tarefaId);
      return executarOuEnfileirar(qc, 'manutencao.inserirExecucao', {
        id: crypto.randomUUID(),
        tarefaId,
        dataExecucao,
        dataPrevista: dataPrevistaParaNova(entradas, dataExecucao, frequenciaDias),
        base: 'execucao',
      });
    },
    onSuccess: depois(qc),
  });
}

/** Troca a data de uma execução ou a base da próxima (a partir da data feita / voltar à original). */
export function useAtualizarExecucaoTarefa() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: () => undefined,
    mutationFn: (dados: { id: string; tarefaId: string; dataExecucao?: string; base?: BaseProximaExecucao }) =>
      executarOuEnfileirar(qc, 'manutencao.atualizarExecucao', dados),
    onSuccess: depois(qc),
  });
}

export function useExcluirExecucaoTarefa() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: () => undefined,
    mutationFn: (dados: { id: string; tarefaId: string }) => executarOuEnfileirar(qc, 'manutencao.excluirExecucao', dados),
    onSuccess: depois(qc),
  });
}
