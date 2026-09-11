import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { Item } from '../types';

const QUERY_KEY = ['itens'];

export interface DadosItem {
  nome: string;
  categoria_id: string | null;
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

export function useCriarItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dados: DadosItem) => {
      const { data, error } = await supabase.from('itens').insert(dados).select().single();
      if (error) throw error;
      return data as Item;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useAtualizarItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: DadosItem }) => {
      const { error } = await supabase.from('itens').update(dados).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useExcluirItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('itens').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
