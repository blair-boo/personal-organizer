import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
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

/** Substitui o conjunto de tags (cômodos) de uma tarefa (o formulário sempre manda a lista completa). */
export function useDefinirClassificacoesTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tarefaId, tagIds }: { tarefaId: string; tagIds: string[] }) => {
      const { error: erroExcluir } = await supabase.from('tarefa_classificacoes').delete().eq('tarefa_id', tarefaId);
      if (erroExcluir) throw erroExcluir;
      if (tagIds.length > 0) {
        const { error: erroInserir } = await supabase
          .from('tarefa_classificacoes')
          .insert(tagIds.map((tagId) => ({ tarefa_id: tarefaId, tag_id: tagId })));
        if (erroInserir) throw erroInserir;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
