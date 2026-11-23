import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { executarOuEnfileirar } from '../lib/offline/executarOuEnfileirar';
import { aposGravar, SEM_BLOQUEIO_OFFLINE } from './mutacoesOffline';

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

  const ordem = { campo: ordenarPor, decrescente: true };

  function useIncluir() {
    const qc = useQueryClient();
    return useMutation({
      onMutate: SEM_BLOQUEIO_OFFLINE,
      mutationFn: (dados: Dados & { id?: string }) =>
        executarOuEnfileirar(qc, 'tabela.inserir', { tabela, consulta: [tabela], linha: { ...dados, id: dados.id ?? crypto.randomUUID() }, ordenarPor: ordem }),
      onSuccess: aposGravar(qc, [[tabela]]),
    });
  }

  function useAtualizar() {
    const qc = useQueryClient();
    return useMutation({
      onMutate: SEM_BLOQUEIO_OFFLINE,
      mutationFn: ({ id, dados }: { id: string; dados: Partial<Dados> }) =>
        executarOuEnfileirar(qc, 'tabela.atualizar', { tabela, consultas: [[tabela]], id, mudancas: { ...dados }, ordenarPor: ordem }),
      onSuccess: aposGravar(qc, [[tabela]]),
    });
  }

  function useExcluir() {
    const qc = useQueryClient();
    return useMutation({
      onMutate: SEM_BLOQUEIO_OFFLINE,
      mutationFn: (id: string) => executarOuEnfileirar(qc, 'tabela.excluir', { tabela, consultas: [[tabela]], ids: [id] }),
      onSuccess: aposGravar(qc, [[tabela]]),
    });
  }

  return { useLista, useIncluir, useAtualizar, useExcluir };
}
