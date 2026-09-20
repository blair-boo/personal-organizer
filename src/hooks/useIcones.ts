import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { urlIconeSupabase } from '../components/IconeSupabase';
import { caminhoIcone } from '../lib/storage';
import { mensagemDeErro } from '../lib/erros';
import { ICONES_CATEGORIAS_PROTEGIDOS } from '../lib/iconesCategorias';
import type { IconeArquivo } from '../types';

const BUCKET = 'icones';

/** Ícones de ação usados por nome fixo em botões do app inteiro (vassoura/salvar/excluir) — nunca renomear/excluir por aqui. */
const ICONES_ACAO_PROTEGIDOS = new Set(['broomstick.svg', 'save.svg', 'trash3.svg']);

function ehProtegido(pasta: string, nome: string): boolean {
  return pasta === '' ? ICONES_ACAO_PROTEGIDOS.has(nome) : ICONES_CATEGORIAS_PROTEGIDOS.has(nome);
}

function queryKey(pasta: string) {
  return ['icones_galeria', pasta];
}

/** Ícones de uma pasta do bucket `icones` (raiz = '', 'PNG' = ilustrações), com a ordem salva em `icones_metadados`. */
export function useIconesGaleria(pasta: string) {
  return useQuery({
    queryKey: queryKey(pasta),
    queryFn: async () => {
      const [{ data: arquivos, error: erroStorage }, { data: metadados, error: erroMetadados }] = await Promise.all([
        supabase.storage.from(BUCKET).list(pasta, { sortBy: { column: 'name', order: 'asc' } }),
        supabase.from('icones_metadados').select('*').eq('pasta', pasta),
      ]);
      if (erroStorage) throw erroStorage;
      if (erroMetadados) throw erroMetadados;

      const metadadosPorNome = new Map((metadados ?? []).map((m) => [m.arquivo as string, m]));

      return (arquivos ?? [])
        .filter((item) => item.id !== null)
        .map((item): IconeArquivo => {
          const meta = metadadosPorNome.get(item.name);
          return {
            id: meta?.id ?? item.name,
            nome: item.name,
            url: urlIconeSupabase(caminhoIcone(pasta, item.name)),
            ordem: meta?.ordem ?? Number.MAX_SAFE_INTEGER,
            protegido: ehProtegido(pasta, item.name),
          };
        })
        .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
    },
  });
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
    onSettled: () => qc.invalidateQueries({ queryKey: queryKey(pasta) }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(pasta) }),
  });
}

export function useExcluirIcone(pasta: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error: erroRemove } = await supabase.storage.from(BUCKET).remove([caminhoIcone(pasta, nome)]);
      if (erroRemove) throw erroRemove;
      const { error: erroMeta } = await supabase.from('icones_metadados').delete().eq('id', id);
      if (erroMeta) throw erroMeta;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(pasta) }),
  });
}

/** Persiste uma nova ordem (id -> índice) pra um conjunto de ícones de uma pasta. */
export function useReordenarIcones(pasta: string) {
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
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKey(pasta) }),
  });
}
