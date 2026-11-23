import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { executarOuEnfileirar } from '../lib/offline/executarOuEnfileirar';
import { aposGravar, SEM_BLOQUEIO_OFFLINE } from './mutacoesOffline';
import { caminhoAnexoProjeto } from '../lib/storage';
import type { ProjetoAnexo } from '../types';

const BUCKET = 'projetos-anexos';

function queryKey(projetoId: string) {
  return ['projeto_anexos', projetoId];
}

export function useProjetoAnexos(projetoId: string) {
  return useQuery({
    queryKey: queryKey(projetoId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projeto_anexos')
        .select('*')
        .eq('projeto_id', projetoId)
        .order('criado_em');
      if (error) throw error;
      return data as ProjetoAnexo[];
    },
  });
}

export function useAdicionarAnexoProjeto(projetoId: string) {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: ({ arquivo, descricao }: { arquivo: File; descricao: string }) =>
      executarOuEnfileirar(qc, 'anexo.incluir', {
        tabela: 'projeto_anexos',
        consulta: queryKey(projetoId),
        linha: { id: crypto.randomUUID(), projeto_id: projetoId, descricao, arquivo_url: caminhoAnexoProjeto(projetoId, descricao, arquivo), nome_arquivo: arquivo.name },
        bucket: BUCKET,
        arquivoLocal: arquivo,
        nomeArquivo: arquivo.name,
      }),
    onSuccess: aposGravar(qc, [queryKey(projetoId)]),
  });
}

export function useRemoverAnexoProjeto(projetoId: string) {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: (anexo: ProjetoAnexo) => executarOuEnfileirar(qc, 'anexo.excluir', { tabela: 'projeto_anexos', consulta: queryKey(projetoId), id: anexo.id, bucket: BUCKET, caminho: anexo.arquivo_url }),
    onSuccess: aposGravar(qc, [queryKey(projetoId)]),
  });
}
