import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { executarOuEnfileirar } from '../lib/offline/executarOuEnfileirar';
import { aposGravar, SEM_BLOQUEIO_OFFLINE } from './mutacoesOffline';
import type { TagItem } from '../types';

const QUERY_KEY = ['tarefa_classificacoes'];

interface LinhaTarefaClassificacao {
  tarefa_id: string;
  tags_itens: TagItem;
}

/** Mapa tarefa_id -> tags (cômodos) dela, montado a partir de todos os vínculos de uma vez. */
export function useTodasTarefaClassificacoes() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tarefa_classificacoes')
        .select('tarefa_id, tags_itens(id, nome, cor, icone_url)');
      if (error) throw error;
      const mapa = new Map<string, TagItem[]>();
      for (const linha of data as unknown as LinhaTarefaClassificacao[]) {
        const lista = mapa.get(linha.tarefa_id) ?? [];
        lista.push(linha.tags_itens);
        mapa.set(linha.tarefa_id, lista);
      }
      return mapa;
    },
  });
}

/** Substitui o conjunto de tags (cômodos) de uma tarefa (o formulário sempre manda a lista completa). Funciona sem internet. */
export function useDefinirClassificacoesTarefa() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: ({ tarefaId, tagIds }: { tarefaId: string; tagIds: string[] }) => {
      const todas = qc.getQueryData<TagItem[]>(['tags_itens']) ?? [];
      const tags = tagIds.map((id) => todas.find((t) => t.id === id)).filter((t): t is TagItem => !!t);
      return executarOuEnfileirar(qc, 'tarefa.definirClassificacoes', { tarefaId, tagIds, tags });
    },
    onSuccess: aposGravar(qc, [QUERY_KEY]),
  });
}
