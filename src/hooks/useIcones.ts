import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { urlIconeSupabase } from '../components/IconeSupabase';
import { caminhoIcone, slugify } from '../lib/storage';
import { mensagemDeErro } from '../lib/erros';
import type { IconeArquivo, PastaIcones } from '../types';

const BUCKET = 'icones';

/** Arquivo vazio que o Storage precisa para a pasta existir (ele não guarda pasta vazia). Nunca aparece como ícone. */
const ARQUIVO_PLACEHOLDER = '.emptyFolderPlaceholder';

const CHAVE_GALERIA = 'icones_galeria';
const PASTAS = '__pastas';

function queryKey(pasta: string) {
  return [CHAVE_GALERIA, pasta];
}

/** Invalida a galeria inteira (todas as pastas e a lista de pastas). */
function invalidarGaleria(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: [CHAVE_GALERIA] });
}

async function buscarIconesDaPasta(pasta: string): Promise<IconeArquivo[]> {
  const [{ data: arquivos, error: erroStorage }, { data: metadados, error: erroMetadados }] = await Promise.all([
    supabase.storage.from(BUCKET).list(pasta, { sortBy: { column: 'name', order: 'asc' } }),
    supabase.from('icones_metadados').select('*').eq('pasta', pasta),
  ]);
  if (erroStorage) throw erroStorage;
  if (erroMetadados) throw erroMetadados;

  const metadadosPorNome = new Map((metadados ?? []).map((m) => [m.arquivo as string, m]));
  const arquivosValidos = (arquivos ?? []).filter((item) => item.id !== null && item.name !== ARQUIVO_PLACEHOLDER);

  // Arquivos enviados direto no Storage ficam sem linha em icones_metadados (e sem uuid):
  // cria a linha aqui pra renomear, reordenar e excluir sempre terem um id válido.
  const semMetadado = arquivosValidos.filter((item) => !metadadosPorNome.has(item.name));
  if (semMetadado.length > 0) {
    const maiorOrdem = Math.max(0, ...(metadados ?? []).map((m) => m.ordem as number));
    const { data: criados, error: erroCriar } = await supabase
      .from('icones_metadados')
      .upsert(
        semMetadado.map((item, i) => ({ pasta, arquivo: item.name, ordem: maiorOrdem + i + 1 })),
        { onConflict: 'pasta,arquivo' }
      )
      .select('*');
    if (erroCriar) throw erroCriar;
    for (const m of criados ?? []) metadadosPorNome.set(m.arquivo as string, m);
  }

  return arquivosValidos
    .map((item): IconeArquivo => {
      const meta = metadadosPorNome.get(item.name)!;
      return {
        id: meta.id,
        nome: item.name,
        url: urlIconeSupabase(caminhoIcone(pasta, item.name)),
        ordem: meta.ordem,
      };
    })
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
}

/** Ícones de uma pasta do bucket `icones` ('' = raiz), com a ordem salva em `icones_metadados`. */
export function useIconesGaleria(pasta: string) {
  return useQuery({
    queryKey: queryKey(pasta),
    queryFn: () => buscarIconesDaPasta(pasta),
  });
}

/** Nomes das pastas do bucket `icones` (um nível), em ordem alfabética. Cada pasta é uma divisão da galeria. */
export function useSubpastasIcones() {
  return useQuery({
    queryKey: [CHAVE_GALERIA, PASTAS],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).list('', { sortBy: { column: 'name', order: 'asc' } });
      if (error) throw error;
      return (data ?? []).filter((item) => item.id === null && !item.name.startsWith('.')).map((item) => item.name);
    },
  });
}

/** Cria uma pasta nova no bucket (nome convertido em slug). Devolve o nome final da pasta. */
export function useCriarPastaIcone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string) => {
      const pasta = slugify(nome);
      if (!pasta) throw new Error('Dê um nome válido à pasta.');
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(`${pasta}/${ARQUIVO_PLACEHOLDER}`, new Blob(['']), { contentType: 'text/plain', upsert: true });
      if (error) throw error;
      return pasta;
    },
    onSettled: () => invalidarGaleria(qc),
  });
}

/** Todas as pastas (a raiz como '') com seus ícones, para escolher um ícone em qualquer pasta. */
export function useIconesTodasPastas(): { pastas: PastaIcones[]; carregando: boolean; erro: unknown } {
  const subpastas = useSubpastasIcones();
  const nomes = ['', ...(subpastas.data ?? [])];
  const consultas = useQueries({
    queries: nomes.map((pasta) => ({ queryKey: queryKey(pasta), queryFn: () => buscarIconesDaPasta(pasta) })),
  });
  return {
    pastas: nomes.map((pasta, i) => ({ pasta, icones: consultas[i]?.data ?? [] })),
    carregando: subpastas.isLoading || consultas.some((c) => c.isLoading),
    erro: subpastas.error ?? consultas.find((c) => c.error)?.error ?? null,
  };
}

/** Sobe um ou mais ícones novos pra pasta, com a próxima ordem disponível. Não passa por modo de edição — salva na hora, como "+ Categoria". */
export function useAdicionarIcones(pasta: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (arquivos: File[]) => {
      const { data: maxRow } = await supabase
        .from('icones_metadados')
        .select('ordem')
        .eq('pasta', pasta)
        .order('ordem', { ascending: false })
        .limit(1)
        .maybeSingle();
      let proximaOrdem = (maxRow?.ordem ?? 0) + 1;

      const erros: string[] = [];
      for (const arquivo of arquivos) {
        const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(caminhoIcone(pasta, arquivo.name), arquivo);
        if (erroUpload) {
          erros.push(`${arquivo.name}: ${mensagemDeErro(erroUpload)}`);
          continue;
        }
        const { error: erroMeta } = await supabase
          .from('icones_metadados')
          .insert({ pasta, arquivo: arquivo.name, ordem: proximaOrdem });
        if (erroMeta) {
          erros.push(`${arquivo.name}: ${mensagemDeErro(erroMeta)}`);
          continue;
        }
        proximaOrdem++;
      }
      if (erros.length > 0) throw new Error(erros.join('; '));
    },
    onSettled: () => invalidarGaleria(qc),
  });
}

/** Renomeia o arquivo no Storage e atualiza o metadado — mantém a extensão original. */
export function useRenomearIcone(pasta: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nomeAntigo, nomeNovo }: { id: string; nomeAntigo: string; nomeNovo: string }) => {
      if (nomeNovo === nomeAntigo) return;
      const { error: erroMove } = await supabase.storage.from(BUCKET).move(caminhoIcone(pasta, nomeAntigo), caminhoIcone(pasta, nomeNovo));
      if (erroMove) throw erroMove;
      const { error: erroMeta } = await supabase.from('icones_metadados').update({ arquivo: nomeNovo }).eq('id', id);
      if (erroMeta) throw erroMeta;
    },
    onSuccess: () => invalidarGaleria(qc),
  });
}

/** Exclui o arquivo e o metadado. Quem chama deve garantir que o ícone não está em uso (ver `arquivosEmUso`). */
export function useExcluirIcone(pasta: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error: erroRemove } = await supabase.storage.from(BUCKET).remove([caminhoIcone(pasta, nome)]);
      if (erroRemove) throw erroRemove;
      const { error: erroMeta } = await supabase.from('icones_metadados').delete().eq('id', id);
      if (erroMeta) throw erroMeta;
    },
    onSuccess: () => invalidarGaleria(qc),
  });
}

/** Persiste uma nova ordem (id -> índice) pra um conjunto de ícones (os ids já identificam a pasta). */
export function useReordenarIcones() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ordens: { id: string; ordem: number }[]) => {
      await Promise.all(
        ordens.map(({ id, ordem }) =>
          supabase
            .from('icones_metadados')
            .update({ ordem })
            .eq('id', id)
            .then(({ error }) => {
              if (error) throw error;
            })
        )
      );
    },
    onSuccess: () => invalidarGaleria(qc),
  });
}
