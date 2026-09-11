import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { caminhoAnexoProjeto, enviarArquivo, removerArquivo } from '../lib/storage';
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
    mutationFn: async ({ arquivo, descricao }: { arquivo: File; descricao: string }) => {
      const caminho = caminhoAnexoProjeto(projetoId, descricao, arquivo);
      await enviarArquivo(BUCKET, caminho, arquivo);
      const { error } = await supabase.from('projeto_anexos').insert({
        projeto_id: projetoId,
        descricao,
        arquivo_url: caminho,
        nome_arquivo: arquivo.name,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(projetoId) }),
  });
}

export function useRemoverAnexoProjeto(projetoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (anexo: ProjetoAnexo) => {
      await removerArquivo(BUCKET, anexo.arquivo_url);
      const { error } = await supabase.from('projeto_anexos').delete().eq('id', anexo.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(projetoId) }),
  });
}
