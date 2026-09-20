import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { urlIconeSupabase } from '../components/IconeSupabase';
import type { IconeArquivo } from '../types';

const QUERY_KEY = ['icones_teste'];
const BUCKET = 'icones';
const PASTA_PNG = 'PNG';

/** Arquivos de uma pasta do bucket `icones` (raiz = ''). Pseudo-entradas de pasta vêm com `id: null`, por isso o filtro. */
async function listarIcones(pasta: string): Promise<IconeArquivo[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(pasta, { sortBy: { column: 'name', order: 'asc' } });
  if (error) throw error;
  const arquivos = (data ?? []).filter((item) => item.id !== null);
  return arquivos.map((item) => {
    const caminho = pasta ? `${pasta}/${item.name}` : item.name;
    return { nome: item.name, url: urlIconeSupabase(caminho) };
  });
}

/** Ícones do bucket `icones` pra aba Testes: `svg` é a raiz do bucket, `png` é a pasta PNG/. */
export function useIconesTeste() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const [svg, png] = await Promise.all([listarIcones(''), listarIcones(PASTA_PNG)]);
      return { svg, png };
    },
  });
}
