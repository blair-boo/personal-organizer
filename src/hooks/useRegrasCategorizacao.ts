import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export interface RegraCategorizacao {
  id: string;
  descricao_normalizada: string;
  categoria_id: string;
  ultima_utilizacao: string;
}

const QUERY_KEY_TODAS = ['regras_categorizacao', 'todas'];

export function useTodasRegras() {
  return useQuery({
    queryKey: QUERY_KEY_TODAS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regras_categorizacao')
        .select('*')
        .order('ultima_utilizacao', { ascending: false });
      if (error) throw error;
      return data as RegraCategorizacao[];
    },
  });
}

export function useExcluirRegra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('regras_categorizacao').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY_TODAS }),
  });
}

export function useAtualizarCategoriaRegra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, categoriaId }: { id: string; categoriaId: string }) => {
      const { error } = await supabase.from('regras_categorizacao').update({ categoria_id: categoriaId }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY_TODAS }),
  });
}

/** Busca as regras de categorização (o "banco de lançamentos") já aprendidas pra um conjunto de descrições normalizadas. */
export function useRegrasPara(descricoesNormalizadas: string[]) {
  return useQuery({
    queryKey: ['regras_categorizacao', [...descricoesNormalizadas].sort()],
    enabled: descricoesNormalizadas.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regras_categorizacao')
        .select('descricao_normalizada, categoria_id')
        .in('descricao_normalizada', descricoesNormalizadas);
      if (error) throw error;
      const mapa = new Map<string, string>();
      for (const linha of data) mapa.set(linha.descricao_normalizada, linha.categoria_id);
      return mapa;
    },
  });
}

export function useSalvarRegra() {
  const qc = useQueryClient();
  return async (descricaoNormalizada: string, categoriaId: string) => {
    const { error } = await supabase
      .from('regras_categorizacao')
      .upsert(
        { descricao_normalizada: descricaoNormalizada, categoria_id: categoriaId, ultima_utilizacao: new Date().toISOString() },
        { onConflict: 'descricao_normalizada' }
      );
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ['regras_categorizacao'] });
  };
}
