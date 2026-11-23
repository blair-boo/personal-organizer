import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { executarOuEnfileirar } from '../lib/offline/executarOuEnfileirar';
import { aposGravar, SEM_BLOQUEIO_OFFLINE } from './mutacoesOffline';
import { caminhoDocumentoItem } from '../lib/storage';
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
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: ({ arquivo, tipo, descricao }: { arquivo: File; tipo: TipoDocumentoItem; descricao: string | null }) =>
      executarOuEnfileirar(qc, 'anexo.incluir', {
        tabela: 'item_documentos',
        consulta: queryKey(itemId),
        linha: { id: crypto.randomUUID(), item_id: itemId, tipo, descricao, arquivo_url: caminhoDocumentoItem(itemId, nomeItem, tipo, arquivo), nome_arquivo: arquivo.name },
        bucket: BUCKET,
        arquivoLocal: arquivo,
        nomeArquivo: arquivo.name,
      }),
    onSuccess: aposGravar(qc, [queryKey(itemId)]),
  });
}

export function useRemoverDocumentoItem(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: (doc: ItemDocumento) => executarOuEnfileirar(qc, 'anexo.excluir', { tabela: 'item_documentos', consulta: queryKey(itemId), id: doc.id, bucket: BUCKET, caminho: doc.arquivo_url }),
    onSuccess: aposGravar(qc, [queryKey(itemId)]),
  });
}
