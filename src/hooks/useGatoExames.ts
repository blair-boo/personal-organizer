import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { caminhoExameGato, enviarArquivo, removerArquivo } from '../lib/storage';
import type { GatoExame } from '../types';
import { criarHooksDeRegistros } from './registrosDoGato';

export const BUCKET_GATOS = 'confidencial';

export interface DadosExame {
  gato_id: string;
  data: string;
  nome: string;
  arquivo_url: string;
  nome_arquivo: string;
}

const hooks = criarHooksDeRegistros<GatoExame, DadosExame>('gato_exames');

/** Exames de todos os gatos: data, nome e arquivo (bucket confidencial, subpasta gatos). */
export const useGatoExames = hooks.useLista;

/** Envia o arquivo e grava o exame. */
export function useIncluirGatoExame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ gatoId, data, nome, arquivo }: { gatoId: string; data: string; nome: string; arquivo: File }) => {
      const caminho = caminhoExameGato(gatoId, nome, arquivo);
      await enviarArquivo(BUCKET_GATOS, caminho, arquivo);
      const { error } = await supabase.from('gato_exames').insert({ gato_id: gatoId, data, nome, arquivo_url: caminho, nome_arquivo: arquivo.name });
      if (error) {
        await removerArquivo(BUCKET_GATOS, caminho).catch(() => undefined);
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gato_exames'] }),
  });
}

export const useAtualizarGatoExame = hooks.useAtualizar;

/** Apaga o exame e o arquivo dele. */
export function useExcluirGatoExame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (exame: GatoExame) => {
      await removerArquivo(BUCKET_GATOS, exame.arquivo_url);
      const { error } = await supabase.from('gato_exames').delete().eq('id', exame.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gato_exames'] }),
  });
}
