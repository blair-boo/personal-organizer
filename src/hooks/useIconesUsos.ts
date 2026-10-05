import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { AlvoIcone, TemaIcone, UsoIcone } from '../types';

export const CHAVE_USOS = ['icones_usos'];

/** Todos os usos de ícone (funções, categorias e abas). Poucas linhas, então vem tudo de uma vez. */
export function useIconesUsos() {
  return useQuery({
    queryKey: CHAVE_USOS,
    queryFn: async (): Promise<UsoIcone[]> => {
      const { data, error } = await supabase.from('icones_usos').select('*');
      if (error) throw error;
      return (data ?? []) as UsoIcone[];
    },
  });
}

/** Grava (cria ou troca) o uso de um alvo. Se o tema for 'ambos', remove as linhas específicas de claro/escuro; se for específico, mantém as demais. */
export function useSalvarUsoIcone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (uso: UsoIcone) => {
      const base = { alvo_tipo: uso.alvo_tipo, alvo_id: uso.alvo_id };
      if (uso.tema === 'ambos') {
        const { error } = await supabase.from('icones_usos').delete().match(base).neq('tema', 'ambos');
        if (error) throw error;
      }
      const { id: _id, ...linha } = uso;
      void _id;
      const { error } = await supabase.from('icones_usos').upsert(linha, { onConflict: 'alvo_tipo,alvo_id,tema' });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CHAVE_USOS }),
  });
}

/** Remove o ícone de um alvo (todos os temas, ou só um). O arquivo continua no bucket. */
export function useRemoverUsoIcone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ alvoTipo, alvoId, tema }: { alvoTipo: AlvoIcone; alvoId: string; tema?: TemaIcone }) => {
      let consulta = supabase.from('icones_usos').delete().match({ alvo_tipo: alvoTipo, alvo_id: alvoId });
      if (tema) consulta = consulta.eq('tema', tema);
      const { error } = await consulta;
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CHAVE_USOS }),
  });
}

/** Aplica várias trocas de uma vez (usado ao salvar o modo de edição de abas). `null` remove o ícone do alvo. */
export function useAplicarUsosIcone() {
  const qc = useQueryClient();
  const salvar = useSalvarUsoIcone();
  const remover = useRemoverUsoIcone();
  return useMutation({
    mutationFn: async (mudancas: { alvoTipo: AlvoIcone; alvoId: string; uso: UsoIcone | null }[]) => {
      for (const m of mudancas) {
        if (m.uso) await salvar.mutateAsync(m.uso);
        else await remover.mutateAsync({ alvoTipo: m.alvoTipo, alvoId: m.alvoId });
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CHAVE_USOS }),
  });
}
