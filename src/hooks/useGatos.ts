import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { removerArquivos } from '../lib/storage';
import type { Gato } from '../types';

export function useGatos() {
  return useQuery({
    queryKey: ['gatos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gatos').select('*').order('ordem').order('nome');
      if (error) throw error;
      return data as Gato[];
    },
  });
}

export function useCriarGato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nome, nascimento, ordem }: { nome: string; nascimento: string | null; ordem: number }) => {
      const { data, error } = await supabase.from('gatos').insert({ nome, nascimento, ordem }).select().single();
      if (error) throw error;
      return data as Gato;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gatos'] }),
  });
}

export function useAtualizarGato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<Pick<Gato, 'nome' | 'nascimento' | 'ordem'>> }) => {
      const { error } = await supabase.from('gatos').update(dados).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gatos'] }),
  });
}

/** Persiste uma nova ordem (id -> posição) para os gatos. */
export function useReordenarGatos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ordens: { id: string; ordem: number }[]) => {
      for (const { id, ordem } of ordens) {
        const { error } = await supabase.from('gatos').update({ ordem }).eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gatos'] }),
  });
}

/** Exclui o gato com tudo dele (as linhas saem por cascade; os arquivos dos exames e dos documentos são apagados do bucket antes). */
export function useExcluirGato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: exames, error: erroExames } = await supabase.from('gato_exames').select('arquivo_url').eq('gato_id', id);
      if (erroExames) throw erroExames;
      const { data: documentos, error: erroDocumentos } = await supabase.from('documentos').select('id').eq('gato_id', id);
      if (erroDocumentos) throw erroDocumentos;
      const ids = (documentos as { id: string }[]).map((d) => d.id);
      const { data: anexos, error: erroAnexos } = ids.length > 0 ? await supabase.from('documentos_anexos').select('arquivo_url').in('documento_id', ids) : { data: [], error: null };
      if (erroAnexos) throw erroAnexos;
      await removerArquivos('confidencial', [...(exames as { arquivo_url: string }[]), ...(anexos as { arquivo_url: string }[])].map((a) => a.arquivo_url));
      const { error } = await supabase.from('gatos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['gatos'] }), qc.invalidateQueries({ queryKey: ['documentos'] })]),
  });
}
