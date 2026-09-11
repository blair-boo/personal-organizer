import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { competenciaParaData } from '../lib/datas';

export function useCriarImportacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contaId,
      competencia,
      nomeArquivo,
      arquivoUrl,
    }: {
      contaId: string;
      competencia: string;
      nomeArquivo: string;
      arquivoUrl: string;
    }) => {
      const { data, error } = await supabase
        .from('importacoes')
        .insert({
          conta_id: contaId,
          competencia: competenciaParaData(competencia),
          nome_arquivo: nomeArquivo,
          arquivo_url: arquivoUrl,
          status: 'revisao',
        })
        .select()
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['importacoes'] }),
  });
}

export function useConcluirImportacao() {
  return useMutation({
    mutationFn: async (importacaoId: string) => {
      const { error } = await supabase.from('importacoes').update({ status: 'concluida' }).eq('id', importacaoId);
      if (error) throw error;
    },
  });
}
