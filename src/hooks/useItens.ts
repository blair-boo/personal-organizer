import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { executarOuEnfileirar } from '../lib/offline/executarOuEnfileirar';
import { aposGravar, SEM_BLOQUEIO_OFFLINE } from './mutacoesOffline';
import type { Item } from '../types';

const QUERY_KEY = ['itens'];

export interface DadosItem {
  nome: string;
  marca: string | null;
  modelo: string | null;
  data_compra: string | null;
  garantia_ate: string | null;
  valor: number | null;
  observacoes: string | null;
}

export function useItens() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('itens').select('*').order('nome');
      if (error) throw error;
      return data as Item[];
    },
  });
}

const ORDEM = { campo: 'nome' };

/** Cria o item (funciona sem internet: o id nasce no aparelho). */
export function useCriarItem() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: async (dados: DadosItem) => {
      const item = { id: crypto.randomUUID(), ...dados } as Item;
      const resultado = await executarOuEnfileirar(qc, 'tabela.inserir', { tabela: 'itens', consulta: QUERY_KEY, linha: item, ordenarPor: ORDEM });
      return { item, resultado };
    },
    onSuccess: ({ resultado }) => aposGravar(qc, [QUERY_KEY])(resultado),
  });
}

export function useAtualizarItem() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: ({ id, dados }: { id: string; dados: DadosItem }) =>
      executarOuEnfileirar(qc, 'tabela.atualizar', { tabela: 'itens', consultas: [QUERY_KEY], id, mudancas: { ...dados }, ordenarPor: ORDEM }),
    onSuccess: aposGravar(qc, [QUERY_KEY]),
  });
}

export function useExcluirItem() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: (id: string) => executarOuEnfileirar(qc, 'tabela.excluir', { tabela: 'itens', consultas: [QUERY_KEY], ids: [id] }),
    onSuccess: aposGravar(qc, [QUERY_KEY]),
  });
}
