import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { escolherRegra } from '../lib/financas';
import { supabase } from '../lib/supabaseClient';

export interface RegraCategorizacao {
  id: string;
  descricao_normalizada: string;
  categoria_id: string;
  ultima_utilizacao: string;
  /** Dono da regra. Nulo é regra do Conjunto. */
  dono_id: string | null;
}

const QUERY_KEY = ['regras_categorizacao'];

/** Todas as regras que a RLS deixa eu ver (minhas, do Conjunto e de quem liberou). A página filtra por pessoa. */
export function useTodasRegras() {
  const meuId = useAuth().session?.user.id;
  return useQuery({
    queryKey: [...QUERY_KEY, meuId, 'todas'],
    enabled: !!meuId,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useAtualizarCategoriaRegra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, categoriaId }: { id: string; categoriaId: string }) => {
      const { error } = await supabase.from('regras_categorizacao').update({ categoria_id: categoriaId }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

/**
 * Busca as regras de categorização (o "banco de lançamentos") já aprendidas pra um conjunto de descrições normalizadas.
 * `donoDaConta` é o dono da conta que está sendo importada (nulo numa conta conjunta): a regra dele vem primeiro,
 * depois a do Conjunto, a minha e a de quem compartilhou comigo (ver `escolherRegra`).
 */
export function useRegrasPara(descricoesNormalizadas: string[], donoDaConta: string | null) {
  const meuId = useAuth().session?.user.id;
  return useQuery({
    queryKey: [...QUERY_KEY, meuId, donoDaConta, [...descricoesNormalizadas].sort()],
    enabled: descricoesNormalizadas.length > 0 && !!meuId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regras_categorizacao')
        .select('descricao_normalizada, categoria_id, dono_id, ultima_utilizacao')
        .in('descricao_normalizada', descricoesNormalizadas);
      if (error) throw error;
      const porDescricao = new Map<string, NonNullable<typeof data>>();
      for (const linha of data) {
        const lista = porDescricao.get(linha.descricao_normalizada) ?? [];
        lista.push(linha);
        porDescricao.set(linha.descricao_normalizada, lista);
      }
      const mapa = new Map<string, string>();
      for (const [descricao, regras] of porDescricao) {
        const regra = escolherRegra(regras, donoDaConta, meuId);
        if (regra) mapa.set(descricao, regra.categoria_id);
      }
      return mapa;
    },
  });
}

/** Grava a regra aprendida no banco de lançamentos do dono da conta (nulo: do Conjunto). */
export function useSalvarRegra() {
  const qc = useQueryClient();
  return async (descricaoNormalizada: string, categoriaId: string, donoId: string | null) => {
    const { error } = await supabase
      .from('regras_categorizacao')
      .upsert(
        {
          descricao_normalizada: descricaoNormalizada,
          categoria_id: categoriaId,
          dono_id: donoId,
          ultima_utilizacao: new Date().toISOString(),
        },
        { onConflict: 'dono_id,descricao_normalizada' }
      );
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: QUERY_KEY });
  };
}
