import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { caminhoDocumentoItem, enviarArquivo, removerArquivo } from '../lib/storage';
import type { ItemDocumento, TipoDocumentoItem } from '../types';

const BUCKET = 'itens-docs';

function queryKey(itemId: string) {
  return ['item_documentos', itemId];
}

export function useItemDocumentos(itemId: string) {
  return useQuery({
    queryKey: queryKey(itemId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_documentos')
        .select('*')
        .eq('item_id', itemId)
        .order('criado_em');
      if (error) throw error;
      return data as ItemDocumento[];
    },
  });
}

export function useAdicionarDocumentoItem(itemId: string, nomeItem: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ arquivo, tipo, descricao }: { arquivo: File; tipo: TipoDocumentoItem; descricao: string | null }) => {
      const caminho = caminhoDocumentoItem(itemId, nomeItem, tipo, arquivo);
      await enviarArquivo(BUCKET, caminho, arquivo);
      const { error } = await supabase.from('item_documentos').insert({
        item_id: itemId,
        tipo,
        descricao,
        arquivo_url: caminho,
        nome_arquivo: arquivo.name,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(itemId) }),
  });
}

export function useRemoverDocumentoItem(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: ItemDocumento) => {
      await removerArquivo(BUCKET, doc.arquivo_url);
      const { error } = await supabase.from('item_documentos').delete().eq('id', doc.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(itemId) }),
  });
}
