import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { caminhoFotoGato, removerArquivos } from '../lib/storage';
import { executarOuEnfileirar } from '../lib/offline/executarOuEnfileirar';
import { aposGravar, SEM_BLOQUEIO_OFFLINE } from './mutacoesOffline';
import type { Gato } from '../types';

export function useGatos() {
  return useQuery({
    queryKey: ['gatos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gatos').select('*').order('ordem').order('nome');
      if (error) throw error;
      return data as Gato[];
    },
  });
}

const ORDEM = { campo: 'ordem' };

/** Cria o gato (funciona sem internet: o id nasce no aparelho). */
export function useCriarGato() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: async ({ nome, nascimento, ordem }: { nome: string; nascimento: string | null; ordem: number }) => {
      const gato: Gato = { id: crypto.randomUUID(), nome, nascimento, ordem, foto_url: null };
      const resultado = await executarOuEnfileirar(qc, 'tabela.inserir', { tabela: 'gatos', consulta: ['gatos'], linha: gato, ordenarPor: ORDEM });
      return { gato, resultado };
    },
    onSuccess: ({ resultado }) => aposGravar(qc, [['gatos']])(resultado),
  });
}

export function useAtualizarGato() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: ({ id, dados }: { id: string; dados: Partial<Pick<Gato, 'nome' | 'nascimento' | 'ordem'>> }) =>
      executarOuEnfileirar(qc, 'tabela.atualizar', { tabela: 'gatos', consultas: [['gatos']], id, mudancas: { ...dados }, ordenarPor: ORDEM }),
    onSuccess: aposGravar(qc, [['gatos']]),
  });
}

/** Troca a foto do gato (arquivo = null remove). Sem internet, a foto fica no aparelho e sobe com a fila. */
export function useDefinirFotoGato() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: ({ gato, arquivo }: { gato: Gato; arquivo: File | null }) =>
      executarOuEnfileirar(qc, 'gato.definirFoto', {
        gatoId: gato.id,
        caminho: arquivo ? caminhoFotoGato(gato.id, arquivo) : null,
        anterior: gato.foto_url,
        arquivoLocal: arquivo ?? undefined,
        nomeArquivo: arquivo?.name,
      }),
    onSuccess: aposGravar(qc, [['gatos']]),
  });
}

/** Persiste uma nova ordem (id -> posição) para os gatos. */
export function useReordenarGatos() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: SEM_BLOQUEIO_OFFLINE,
    mutationFn: async (ordens: { id: string; ordem: number }[]) => {
      let resultado: 'enviada' | 'enfileirada' = 'enviada';
      for (const { id, ordem } of ordens) {
        resultado = await executarOuEnfileirar(qc, 'tabela.atualizar', { tabela: 'gatos', consultas: [['gatos']], id, mudancas: { ordem }, ordenarPor: ORDEM });
      }
      return resultado;
    },
    onSuccess: aposGravar(qc, [['gatos']]),
  });
}

/** Exclui o gato com tudo dele (as linhas saem por cascade; os arquivos dos exames e dos documentos são apagados do bucket antes). */
export function useExcluirGato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: exames, error: erroExames } = await supabase.from('gato_exames').select('arquivo_url').eq('gato_id', id);
      if (erroExames) throw erroExames;
      const { data: documentos, error: erroDocumentos } = await supabase.from('documentos').select('id').eq('gato_id', id);
      if (erroDocumentos) throw erroDocumentos;
      const ids = (documentos as { id: string }[]).map((d) => d.id);
      const { data: anexos, error: erroAnexos } = ids.length > 0 ? await supabase.from('documentos_anexos').select('arquivo_url').in('documento_id', ids) : { data: [], error: null };
      if (erroAnexos) throw erroAnexos;
      const { data: gato } = await supabase.from('gatos').select('foto_url').eq('id', id).maybeSingle();
      const foto = (gato as { foto_url: string | null } | null)?.foto_url;
      await removerArquivos('confidencial', [...(exames as { arquivo_url: string }[]), ...(anexos as { arquivo_url: string }[])].map((a) => a.arquivo_url).concat(foto ? [foto] : []));
      const { error } = await supabase.from('gatos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['gatos'] }), qc.invalidateQueries({ queryKey: ['documentos'] })]),
  });
}
