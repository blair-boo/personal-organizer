import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { removerArquivos } from '../lib/storage';
import type { AnexoStorage, CaixaStorage } from '../types';

export const BUCKET_STORAGE = 'confidencial';

const CHAVES_STORAGE = ['storage', 'storage_itens', 'storage_obs', 'storage_anexos'];

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

/** Apaga do bucket os arquivos de todos os anexos desses itens (as linhas saem junto com o item, por cascade). */
async function removerArquivosDosItens(itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;
  const { data, error } = await supabase.from('storage_anexos').select('arquivo_url').in('item_id', itemIds);
  if (error) throw error;
  await removerArquivos(BUCKET_STORAGE, (data as { arquivo_url: string }[]).map((a) => a.arquivo_url));
}

export interface AnexoNovo {
  nome: string;
  arquivo_url: string;
  nome_arquivo: string;
}

export interface ItemParaSalvar {
  id: string;
  nome: string;
  quantidade: number | null;
  categoria_id: string | null;
  obs: string[];
  anexosNovos: AnexoNovo[];
  anexosRemovidos: AnexoStorage[];
}

export interface SalvarCaixaInput {
  id: string;
  nome: string;
  novo: boolean;
  /** Posição da caixa nova (a última + 1). Ignorada ao editar. */
  ordemNova: number;
  /** Itens que ficam na caixa, na ordem em que aparecem. */
  itens: ItemParaSalvar[];
  /** Itens existentes que saíram da caixa (são excluídos, com seus arquivos). */
  itensRemovidos: string[];
}

/**
 * Salva a caixa inteira de uma vez: a caixa (com o id já gerado no navegador,
 * pra bater com os arquivos enviados durante a criação), os itens, as
 * observações e os anexos.
 */
export function useSalvarCaixa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nome, novo, ordemNova, itens, itensRemovidos }: SalvarCaixaInput) => {
      if (novo) {
        const { error } = await supabase.from('storage').insert({ id, nome, ordem: ordemNova });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('storage').update({ nome }).eq('id', id);
        if (error) throw error;
      }

      if (itensRemovidos.length > 0) {
        await removerArquivosDosItens(itensRemovidos);
        const { error } = await supabase.from('storage_itens').delete().in('id', itensRemovidos);
        if (error) throw error;
      }

      if (itens.length === 0) return;
      const linhasItens = itens.map((item, indice) => ({
        id: item.id,
        storage_id: id,
        nome: item.nome,
        quantidade: item.quantidade,
        categoria_id: item.categoria_id,
        ordem: indice + 1,
      }));
      const { error: erroItens } = await supabase.from('storage_itens').upsert(linhasItens);
      if (erroItens) throw erroItens;

      // Observações: substitui o conjunto de cada item.
      const { error: erroLimparObs } = await supabase.from('storage_obs').delete().in('item_id', itens.map((i) => i.id));
      if (erroLimparObs) throw erroLimparObs;
      const linhasObs = itens.flatMap((item) =>
        item.obs.map((texto, indice) => ({ item_id: item.id, texto, ordem: indice + 1 }))
      );
      if (linhasObs.length > 0) {
        const { error } = await supabase.from('storage_obs').insert(linhasObs);
        if (error) throw error;
      }

      // Anexos: os removidos saem do banco e do bucket, os novos entram.
      const removidos = itens.flatMap((item) => item.anexosRemovidos);
      if (removidos.length > 0) {
        const { error } = await supabase.from('storage_anexos').delete().in('id', removidos.map((a) => a.id));
        if (error) throw error;
        await removerArquivos(BUCKET_STORAGE, removidos.map((a) => a.arquivo_url));
      }
      const linhasAnexos = itens.flatMap((item) => item.anexosNovos.map((anexo) => ({ item_id: item.id, ...anexo })));
      if (linhasAnexos.length > 0) {
        const { error } = await supabase.from('storage_anexos').insert(linhasAnexos);
        if (error) throw error;
      }
    },
    onSuccess: () => invalidarStorage(qc),
  });
}

export interface EdicaoEmLote {
  caixas: { id: string; ordem: number }[];
  itens: { id: string; storage_id: string; ordem: number }[];
  renomeacoes: { id: string; nome: string }[];
  caixasExcluidas: string[];
  itensExcluidos: string[];
}

/** Aplica de uma vez o que ficou pendente no modo de edição: ordem, mudança de caixa, nomes e exclusões. */
export function useAplicarEdicaoStorage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ caixas, itens, renomeacoes, caixasExcluidas, itensExcluidos }: EdicaoEmLote) => {
      const excluir = new Set(caixasExcluidas);
      const exclusaoItens = new Set(itensExcluidos);

      // Primeiro o que é movido, pra um item nunca ser apagado junto com a caixa de onde saiu.
      for (const { id, storage_id, ordem } of itens) {
        if (exclusaoItens.has(id)) continue;
        const { error } = await supabase.from('storage_itens').update({ storage_id, ordem }).eq('id', id);
        if (error) throw error;
      }
      for (const { id, nome } of renomeacoes) {
        if (excluir.has(id)) continue;
        const { error } = await supabase.from('storage').update({ nome }).eq('id', id);
        if (error) throw error;
      }
      for (const { id, ordem } of caixas) {
        if (excluir.has(id)) continue;
        const { error } = await supabase.from('storage').update({ ordem }).eq('id', id);
        if (error) throw error;
      }

      if (itensExcluidos.length > 0) {
        await removerArquivosDosItens(itensExcluidos);
        const { error } = await supabase.from('storage_itens').delete().in('id', itensExcluidos);
        if (error) throw error;
      }
      if (caixasExcluidas.length > 0) {
        const { data, error: erroItens } = await supabase.from('storage_itens').select('id').in('storage_id', caixasExcluidas);
        if (erroItens) throw erroItens;
        await removerArquivosDosItens((data as { id: string }[]).map((i) => i.id));
        const { error } = await supabase.from('storage').delete().in('id', caixasExcluidas);
        if (error) throw error;
      }
    },
    onSuccess: () => invalidarStorage(qc),
  });
}
