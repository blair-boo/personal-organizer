import { useMutation, useQueryClient } from '@tanstack/react-query';
import { executarOuEnfileirar } from '../lib/offline/executarOuEnfileirar';
import { caminhoExameGato } from '../lib/storage';
import type { GatoExame } from '../types';
import { aposGravar, SEM_BLOQUEIO_OFFLINE } from './mutacoesOffline';
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

/** Grava o exame e envia o arquivo (sem internet, os dois esperam na fila). */
export function useIncluirGatoExame() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: ({ gatoId, data, nome, arquivo }: { gatoId: string; data: string; nome: string; arquivo: File }) =>
      executarOuEnfileirar(qc, 'anexo.incluir', {
        tabela: 'gato_exames',
        consulta: ['gato_exames'],
        linha: { id: crypto.randomUUID(), gato_id: gatoId, data, nome, arquivo_url: caminhoExameGato(gatoId, nome, arquivo), nome_arquivo: arquivo.name },
        bucket: BUCKET_GATOS,
        arquivoLocal: arquivo,
        nomeArquivo: arquivo.name,
      }),
    onSuccess: aposGravar(qc, [['gato_exames']]),
  });
}

export const useAtualizarGatoExame = hooks.useAtualizar;

/** Apaga o exame e o arquivo dele. */
export function useExcluirGatoExame() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: (exame: GatoExame) => executarOuEnfileirar(qc, 'anexo.excluir', { tabela: 'gato_exames', consulta: ['gato_exames'], id: exame.id, bucket: BUCKET_GATOS, caminho: exame.arquivo_url }),
    onSuccess: aposGravar(qc, [['gato_exames']]),
  });
}
