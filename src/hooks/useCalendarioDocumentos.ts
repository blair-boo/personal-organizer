import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { CalendarioFeed, PessoaDocumentos } from '../types';

const QUERY_KEY = ['documentos_calendario_feeds'];

interface LinhaFeed {
  id: string;
  nome: string;
  token: string;
  criado_em: string;
  documentos_calendario_feed_pessoas: { pessoa: PessoaDocumentos | null }[];
}

export function useCalendarioFeeds() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos_calendario_feeds')
        .select('id, nome, token, criado_em, documentos_calendario_feed_pessoas(pessoa:documentos_pessoas(id,nome,ordem))')
        .order('criado_em');
      if (error) throw error;
      return (data as unknown as LinhaFeed[]).map(
        (linha): CalendarioFeed => ({
          id: linha.id,
          nome: linha.nome,
          token: linha.token,
          criado_em: linha.criado_em,
          pessoas: linha.documentos_calendario_feed_pessoas.map((p) => p.pessoa).filter((p): p is PessoaDocumentos => p !== null),
        })
      );
    },
  });
}

export function useCriarCalendarioFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nome, pessoaIds }: { nome: string; pessoaIds: string[] }) => {
      const { data: feed, error: erroFeed } = await supabase
        .from('documentos_calendario_feeds')
        .insert({ nome })
        .select()
        .single();
      if (erroFeed) throw erroFeed;
      if (pessoaIds.length > 0) {
        const linhas = pessoaIds.map((pessoa_id) => ({ feed_id: feed.id, pessoa_id }));
        const { error } = await supabase.from('documentos_calendario_feed_pessoas').insert(linhas);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

/** Troca quem está incluído no link, sem mudar a URL (token continua o mesmo). */
export function useAtualizarPessoasFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ feedId, pessoaIds }: { feedId: string; pessoaIds: string[] }) => {
      const { error: erroExcluir } = await supabase.from('documentos_calendario_feed_pessoas').delete().eq('feed_id', feedId);
      if (erroExcluir) throw erroExcluir;
      if (pessoaIds.length > 0) {
        const linhas = pessoaIds.map((pessoa_id) => ({ feed_id: feedId, pessoa_id }));
        const { error } = await supabase.from('documentos_calendario_feed_pessoas').insert(linhas);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useRenomearCalendarioFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from('documentos_calendario_feeds').update({ nome }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

/** Gera um token novo pra esse link, invalidando a URL antiga (quem já assinou com ela para de receber atualização). */
export function useGerarNovoTokenFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (feedId: string) => {
      const novoToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      const { error } = await supabase.from('documentos_calendario_feeds').update({ token: novoToken }).eq('id', feedId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useExcluirCalendarioFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('documentos_calendario_feeds').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

/** Monta a URL pública do feed .ics (Edge Function `documentos-ics`) a partir do token de um link. */
export function urlFeedCalendario(token: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  return `${base}/functions/v1/documentos-ics?token=${token}`;
}
