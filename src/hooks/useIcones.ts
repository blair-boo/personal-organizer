import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { urlIconeSupabase } from '../components/IconeSupabase';
import { caminhoIcone, slugify } from '../lib/storage';
import { mensagemDeErro } from '../lib/erros';
import { PASTA_EM_USO, nomeCopiaEmUso } from '../lib/iconesUsos';
import { CHAVE_USOS } from './useIconesUsos';
import type { IconeArquivo, PastaIcones, UsoIcone } from '../types';

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
    supabase.storage.from(BUCKET).list(pasta, { limit: 1000, sortBy: { column: 'name', order: 'asc' } }),
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
      const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
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

/** Exclui a pasta inteira: todos os arquivos do Storage (inclusive o marcador da pasta) e os metadados. Quem chama garante que nada dentro está em uso. */
export function useExcluirPastaIcone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pasta: string) => {
      if (!pasta) throw new Error('A raiz do bucket não pode ser excluída.');
      const { data: arquivos, error: erroLista } = await supabase.storage.from(BUCKET).list(pasta, { limit: 1000 });
      if (erroLista) throw erroLista;
      const caminhos = (arquivos ?? []).filter((item) => item.id !== null).map((item) => caminhoIcone(pasta, item.name));
      if (caminhos.length > 0) {
        const { error: erroRemove } = await supabase.storage.from(BUCKET).remove(caminhos);
        if (erroRemove) throw erroRemove;
      }
      const { error: erroMeta } = await supabase.from('icones_metadados').delete().eq('pasta', pasta);
      if (erroMeta) throw erroMeta;
    },
    onSettled: () => invalidarGaleria(qc),
  });
}

/**
 * Renomeia a pasta: o Storage não tem "renomear pasta", então cada arquivo é movido para o caminho novo
 * e os metadados e os usos (`icones_usos`) passam a apontar para a pasta nova. Devolve o nome final (slug).
 * Se algum arquivo falhar, o que já foi movido é atualizado e o erro lista o que ficou na pasta antiga.
 */
export function useRenomearPastaIcone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pastaAntiga, nomeNovo }: { pastaAntiga: string; nomeNovo: string }) => {
      const pastaNova = slugify(nomeNovo);
      if (!pastaAntiga) throw new Error('A raiz do bucket não pode ser renomeada.');
      if (!pastaNova) throw new Error('Dê um nome válido à pasta.');
      if (pastaNova === pastaAntiga) return pastaNova;

      const { data: raiz, error: erroRaiz } = await supabase.storage.from(BUCKET).list('', { limit: 1000 });
      if (erroRaiz) throw erroRaiz;
      if ((raiz ?? []).some((item) => item.id === null && item.name === pastaNova)) throw new Error('Já existe uma pasta com esse nome.');

      const { data: arquivos, error: erroLista } = await supabase.storage.from(BUCKET).list(pastaAntiga, { limit: 1000 });
      if (erroLista) throw erroLista;

      const movidos: string[] = [];
      const falhas: string[] = [];
      for (const item of (arquivos ?? []).filter((a) => a.id !== null)) {
        const { error } = await supabase.storage.from(BUCKET).move(caminhoIcone(pastaAntiga, item.name), caminhoIcone(pastaNova, item.name));
        if (error) falhas.push(`${item.name}: ${mensagemDeErro(error)}`);
        else movidos.push(item.name);
      }

      if (movidos.length > 0) {
        const { error: erroMeta } = await supabase.from('icones_metadados').update({ pasta: pastaNova }).eq('pasta', pastaAntiga).in('arquivo', movidos);
        if (erroMeta) throw erroMeta;
        const { error: erroUsos } = await supabase.from('icones_usos').update({ icone_pasta: pastaNova }).eq('icone_pasta', pastaAntiga).in('icone_arquivo', movidos);
        if (erroUsos) throw erroUsos;
      }
      if (falhas.length > 0) throw new Error(`Alguns arquivos ficaram na pasta ${pastaAntiga}: ${falhas.join('; ')}`);
      return pastaNova;
    },
    onSettled: () => Promise.all([invalidarGaleria(qc), qc.invalidateQueries({ queryKey: CHAVE_USOS })]),
  });
}

/** Copia o ícone para a pasta `em-uso` (se ainda não estiver lá) e devolve onde ele ficou. A cópia já existente é reaproveitada. */
export async function copiarParaEmUso(pasta: string, arquivo: string): Promise<{ pasta: string; arquivo: string }> {
  if (pasta === PASTA_EM_USO) return { pasta, arquivo };
  const nomeNovo = nomeCopiaEmUso(pasta, arquivo);
  const { error: erroCopia } = await supabase.storage.from(BUCKET).copy(caminhoIcone(pasta, arquivo), caminhoIcone(PASTA_EM_USO, nomeNovo));
  // Cópia que já existe de uma escolha anterior serve do mesmo jeito.
  if (erroCopia && !/exist|duplicate/i.test(erroCopia.message)) throw erroCopia;

  const { data: maxRow } = await supabase.from('icones_metadados').select('ordem').eq('pasta', PASTA_EM_USO).order('ordem', { ascending: false }).limit(1).maybeSingle();
  const { error: erroMeta } = await supabase
    .from('icones_metadados')
    .upsert({ pasta: PASTA_EM_USO, arquivo: nomeNovo, ordem: (maxRow?.ordem ?? 0) + 1 }, { onConflict: 'pasta,arquivo', ignoreDuplicates: true });
  if (erroMeta) throw erroMeta;
  return { pasta: PASTA_EM_USO, arquivo: nomeNovo };
}

/** Copia o ícone escolhido para `em-uso` e atualiza a galeria. */
export function useCopiarParaEmUso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pasta, arquivo }: { pasta: string; arquivo: string }) => copiarParaEmUso(pasta, arquivo),
    onSettled: () => invalidarGaleria(qc),
  });
}

/** Leva para `em-uso` os usos que ainda apontam para outra pasta (copia o arquivo e atualiza o uso). Devolve quantos moveu. */
export function useMigrarUsosParaEmUso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (usos: UsoIcone[]) => {
      const pendentes = usos.filter((u) => u.icone_pasta !== PASTA_EM_USO);
      for (const uso of pendentes) {
        const copia = await copiarParaEmUso(uso.icone_pasta, uso.icone_arquivo);
        const { error } = await supabase
          .from('icones_usos')
          .update({ icone_pasta: copia.pasta, icone_arquivo: copia.arquivo })
          .match({ alvo_tipo: uso.alvo_tipo, alvo_id: uso.alvo_id, tema: uso.tema });
        if (error) throw error;
      }
      return pendentes.length;
    },
    onSettled: () => Promise.all([invalidarGaleria(qc), qc.invalidateQueries({ queryKey: CHAVE_USOS })]),
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
