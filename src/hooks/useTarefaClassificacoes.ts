import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { ClassificacaoTarefa } from '../types';

const QUERY_KEY = ['tarefa_classificacoes'];

interface LinhaTarefaClassificacao {
  tarefa_id: string;
  classificacoes_tarefas: ClassificacaoTarefa;
}

/** Mapa tarefa_id -> classificações dela, montado a partir de todos os vínculos de uma vez. */
export function useTodasTarefaClassificacoes() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tarefa_classificacoes')
        .select('tarefa_id, classificacoes_tarefas(id, nome, cor, icone_url)');
      if (error) throw error;
      const mapa = new Map<string, ClassificacaoTarefa[]>();
      for (const linha of data as unknown as LinhaTarefaClassificacao[]) {
        const lista = mapa.get(linha.tarefa_id) ?? [];
        lista.push(linha.classificacoes_tarefas);
        mapa.set(linha.tarefa_id, lista);
      }
      return mapa;
    },
  });
}

/** Substitui o conjunto de classificações de uma tarefa (o formulário sempre manda a lista completa). */
export function useDefinirClassificacoesTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tarefaId, classificacaoIds }: { tarefaId: string; classificacaoIds: string[] }) => {
      const { error: erroExcluir } = await supabase.from('tarefa_classificacoes').delete().eq('tarefa_id', tarefaId);
      if (erroExcluir) throw erroExcluir;
      if (classificacaoIds.length > 0) {
        const { error: erroInserir } = await supabase
          .from('tarefa_classificacoes')
          .insert(classificacaoIds.map((classificacaoId) => ({ tarefa_id: tarefaId, classificacao_id: classificacaoId })));
        if (erroInserir) throw erroInserir;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
