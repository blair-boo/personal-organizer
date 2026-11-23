import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { executarOuEnfileirar } from '../lib/offline/executarOuEnfileirar';
import { aposGravar, SEM_BLOQUEIO_OFFLINE } from './mutacoesOffline';
import type { Projeto, StatusProjeto } from '../types';

const QUERY_KEY = ['projetos'];

export interface DadosProjeto {
  nome: string;
  descricao: string | null;
  status: StatusProjeto;
  data_inicio: string | null;
  data_conclusao: string | null;
}

export function useProjetos() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('projetos').select('*').order('criado_em', { ascending: false });
      if (error) throw error;
      return data as Projeto[];
    },
  });
}

const ORDEM = { campo: 'criado_em', decrescente: true };

/** Cria o projeto (funciona sem internet: o id nasce no aparelho). */
export function useCriarProjeto() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: async (dados: DadosProjeto) => {
      const projeto = { id: crypto.randomUUID(), ...dados } as Projeto;
      const resultado = await executarOuEnfileirar(qc, 'tabela.inserir', { tabela: 'projetos', consulta: QUERY_KEY, linha: projeto, ordenarPor: ORDEM });
      return { projeto, resultado };
    },
    onSuccess: ({ resultado }) => aposGravar(qc, [QUERY_KEY])(resultado),
  });
}

export function useAtualizarProjeto() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: ({ id, dados }: { id: string; dados: DadosProjeto }) =>
      executarOuEnfileirar(qc, 'tabela.atualizar', { tabela: 'projetos', consultas: [QUERY_KEY], id, mudancas: { ...dados }, ordenarPor: ORDEM }),
    onSuccess: aposGravar(qc, [QUERY_KEY]),
  });
}

export function useExcluirProjeto() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: (id: string) => executarOuEnfileirar(qc, 'tabela.excluir', { tabela: 'projetos', consultas: [QUERY_KEY], ids: [id] }),
    onSuccess: aposGravar(qc, [QUERY_KEY]),
  });
}
