import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { executarOuEnfileirar } from '../lib/offline/executarOuEnfileirar';
import { BUCKET_STORAGE } from '../lib/offline/executores';
import type { EdicaoStorageDados, SalvarCaixaDados } from '../lib/offline/operacoes';
import type { CaixaStorage } from '../types';

export { BUCKET_STORAGE };
export type { AnexoNovoDados, ItemParaSalvar, SalvarCaixaDados, EdicaoStorageDados } from '../lib/offline/operacoes';

const CHAVES_STORAGE = ['storage', 'storage_itens', 'storage_obs', 'storage_anexos', 'storage_caixa_anexos'];

function invalidarStorage(qc: QueryClient) {
  return Promise.all(CHAVES_STORAGE.map((chave) => qc.invalidateQueries({ queryKey: [chave] })));
}

export function useStorageCaixas() {
  return useQuery({
    queryKey: ['storage'],
    queryFn: async () => {
      const { data, error } = await supabase.from('storage').select('*').order('ordem').order('nome');
      if (error) throw error;
      return data as CaixaStorage[];
    },
  });
}

/**
 * Salva a caixa inteira de uma vez. Sem internet a alteração aparece na tela e
 * vai para a fila de envio (as fotos tiradas sem sinal sobem junto).
 */
export function useSalvarCaixa() {
  const qc = useQueryClient();
  return useMutation({
    // Funciona sem internet: não recusa a ação como as demais (ver main.tsx).
    onMutate: () => undefined,
    mutationFn: (dados: SalvarCaixaDados) => executarOuEnfileirar(qc, 'storage.salvarCaixa', dados),
    onSuccess: (resultado) => (resultado === 'enviada' ? invalidarStorage(qc) : undefined),
  });
}

/** Aplica de uma vez o que ficou pendente no modo de edição: ordem, mudança de caixa, nomes e exclusões. */
export function useAplicarEdicaoStorage() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: () => undefined,
    mutationFn: (dados: EdicaoStorageDados) => executarOuEnfileirar(qc, 'storage.aplicarEdicao', dados),
    onSuccess: (resultado) => (resultado === 'enviada' ? invalidarStorage(qc) : undefined),
  });
}
