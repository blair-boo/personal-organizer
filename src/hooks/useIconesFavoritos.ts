import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { IconeFavorito } from '../types';

export const CHAVE_FAVORITOS = ['icones_favoritos'];

/** Ícones favoritos da galeria. Poucas linhas, então vem tudo de uma vez. */
export function useIconesFavoritos() {
  return useQuery({
    queryKey: CHAVE_FAVORITOS,
    queryFn: async (): Promise<IconeFavorito[]> => {
      const { data, error } = await supabase.from('icones_favoritos').select('pasta, arquivo');
      if (error) throw error;
      return (data ?? []) as IconeFavorito[];
    },
  });
}

/** Marca ou desmarca um ícone como favorito. Salva na hora. */
export function useAlternarFavoritoIcone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pasta, arquivo, favorito }: IconeFavorito & { favorito: boolean }) => {
      if (favorito) {
        const { error } = await supabase.from('icones_favoritos').upsert({ pasta, arquivo }, { onConflict: 'pasta,arquivo' });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('icones_favoritos').delete().match({ pasta, arquivo });
        if (error) throw error;
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CHAVE_FAVORITOS }),
  });
}
