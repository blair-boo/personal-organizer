import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { TagItem } from '../types';

const QUERY_KEY = ['item_tags'];

interface LinhaItemTag {
  item_id: string;
  tags_itens: TagItem;
}

/** Mapa item_id -> tags dele, montado a partir de todos os vínculos de uma vez (evita N+1 query por item). */
export function useTodosItemTags() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('item_tags').select('item_id, tags_itens(id, nome, cor, icone_url)');
      if (error) throw error;
      const mapa = new Map<string, TagItem[]>();
      for (const linha of data as unknown as LinhaItemTag[]) {
        const lista = mapa.get(linha.item_id) ?? [];
        lista.push(linha.tags_itens);
        mapa.set(linha.item_id, lista);
      }
      return mapa;
    },
  });
}

/** Substitui o conjunto de tags de um item (o formulário sempre manda a lista completa). */
export function useDefinirTagsItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, tagIds }: { itemId: string; tagIds: string[] }) => {
      const { error: erroExcluir } = await supabase.from('item_tags').delete().eq('item_id', itemId);
      if (erroExcluir) throw erroExcluir;
      if (tagIds.length > 0) {
        const { error: erroInserir } = await supabase
          .from('item_tags')
          .insert(tagIds.map((tagId) => ({ item_id: itemId, tag_id: tagId })));
        if (erroInserir) throw erroInserir;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
