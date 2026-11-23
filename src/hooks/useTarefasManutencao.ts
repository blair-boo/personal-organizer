import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { executarOuEnfileirar } from '../lib/offline/executarOuEnfileirar';
import { aposGravar, SEM_BLOQUEIO_OFFLINE } from './mutacoesOffline';
import type { ResponsavelTipo, TarefaManutencao } from '../types';

const QUERY_KEY = ['tarefas_manutencao'];

export interface DadosTarefaManutencao {
  nome: string;
  frequencia_dias: number;
  ativo: boolean;
  dias_semana: number[];
  instrucoes: string | null;
  responsavel_tipo: ResponsavelTipo;
  responsavel_pessoa_id: string | null;
  responsavel_casal_id: string | null;
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

const ORDEM = { campo: 'nome' };

/** Cria a tarefa (funciona sem internet: o id nasce no aparelho). */
export function useCriarTarefaManutencao() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: async (dados: DadosTarefaManutencao) => {
      const tarefa: TarefaManutencao = { id: crypto.randomUUID(), ...dados, ultima_execucao: null, proxima_a_partir_de: null, adiada_ate: null };
      const resultado = await executarOuEnfileirar(qc, 'tabela.inserir', { tabela: 'tarefas_manutencao', consulta: QUERY_KEY, linha: tarefa, ordenarPor: ORDEM });
      return { tarefa, resultado };
    },
    onSuccess: ({ resultado }) => aposGravar(qc, [QUERY_KEY])(resultado),
  });
}

export function useAtualizarTarefaManutencao() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: ({ id, dados }: { id: string; dados: DadosTarefaManutencao }) =>
      executarOuEnfileirar(qc, 'tabela.atualizar', { tabela: 'tarefas_manutencao', consultas: [QUERY_KEY], id, mudancas: { ...dados }, ordenarPor: ORDEM }),
    onSuccess: aposGravar(qc, [QUERY_KEY]),
  });
}

export function useExcluirTarefaManutencao() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: (id: string) => executarOuEnfileirar(qc, 'tabela.excluir', { tabela: 'tarefas_manutencao', consultas: [QUERY_KEY], ids: [id] }),
    onSuccess: aposGravar(qc, [QUERY_KEY, ['tarefas_manutencao_historico'], ['tarefa_classificacoes'], ['tarefas_historico_pessoas']]),
  });
}
