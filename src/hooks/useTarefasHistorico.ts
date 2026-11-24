import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { dataPrevistaParaNova } from '../lib/historicoTarefa';
import { executarOuEnfileirar } from '../lib/offline/executarOuEnfileirar';
import { entradasDaTarefa } from '../lib/offline/executores';
import { contarFila } from '../lib/offline/fila';
import type { AdiamentoTarefa, BaseProximaExecucao, HistoricoPessoa, HistoricoTarefa, TipoAdiamento } from '../types';

const CHAVE = ['tarefas_manutencao_historico'];

function invalidar(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: CHAVE }),
    qc.invalidateQueries({ queryKey: ['tarefas_manutencao'] }),
    qc.invalidateQueries({ queryKey: ['tarefas_historico_pessoas'] }),
    qc.invalidateQueries({ queryKey: ['tarefas_adiamentos'] }),
  ]);
}

/** Quem fez cada execução (todas as linhas; poucas, e serve à lista, ao kanban e ao uso offline). */
export function useHistoricoPessoas() {
  return useQuery({
    queryKey: ['tarefas_historico_pessoas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tarefas_historico_pessoas').select('*');
      if (error) throw error;
      return data as HistoricoPessoa[];
    },
  });
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
  /** Quem fez. */
  pessoaIds: string[];
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
    mutationFn: ({ tarefaId, dataExecucao, dataPrevista, base, pessoaIds }: RegistroDeExecucao) =>
      executarOuEnfileirar(qc, 'manutencao.inserirExecucao', { id: crypto.randomUUID(), tarefaId, dataExecucao, dataPrevista, base, pessoaIds }),
    onSuccess: depois(qc),
  });
}

/** Inclui à mão uma execução em outra data; a data prevista sai da execução anterior a ela. */
export function useIncluirExecucaoTarefa() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: () => undefined,
    mutationFn: async ({ tarefaId, dataExecucao, frequenciaDias, pessoaIds = [] }: { tarefaId: string; dataExecucao: string; frequenciaDias: number; pessoaIds?: string[] }) => {
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
        pessoaIds,
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

/** Troca quem fez uma execução. */
export function useDefinirPessoasExecucao() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: () => undefined,
    mutationFn: (dados: { historicoId: string; pessoaIds: string[] }) => executarOuEnfileirar(qc, 'manutencao.definirPessoasExecucao', dados),
    onSuccess: depois(qc),
  });
}

/** Histórico de adiamentos de todas as tarefas (quem adiou, para quando e a observação). */
export function useAdiamentosTarefas() {
  return useQuery({
    queryKey: ['tarefas_adiamentos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tarefas_adiamentos').select('*').order('criado_em', { ascending: false });
      if (error) throw error;
      return data as AdiamentoTarefa[];
    },
  });
}

export interface RegistroDeAdiamento {
  tarefaId: string;
  /** Nova data da próxima execução; null cancela o adiamento. */
  adiadaAte: string | null;
  tipo: TipoAdiamento;
  /** Próxima execução prevista antes da mudança. */
  dataAnterior: string | null;
  /** Quem adiou: a pessoa ligada ao login. */
  pessoaId: string | null;
  observacao: string | null;
}

/** Adia a tarefa para uma data, ou cancela o adiamento (adiadaAte = null), guardando quem adiou e a observação. "Pular desta vez" é adiar para a data do ciclo seguinte. */
export function useDefinirAdiamentoTarefa() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: () => undefined,
    mutationFn: (dados: RegistroDeAdiamento) => executarOuEnfileirar(qc, 'manutencao.definirAdiamento', { id: crypto.randomUUID(), ...dados }),
    onSuccess: depois(qc),
  });
}
