import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { CorUsuario } from '../types';

const CHAVE = ['cores_usuario'];
/** Chave antiga do localStorage, importada uma única vez para o Supabase. */
const CHAVE_LOCAL_ANTIGA = 'personal-organizer-testes-swatches';

/** "Minhas cores" salvas no Supabase, na ordem escolhida. */
export function useCoresUsuario() {
  const qc = useQueryClient();
  const consulta = useQuery({
    queryKey: CHAVE,
    queryFn: async (): Promise<CorUsuario[]> => {
      const { data, error } = await supabase.from('cores_usuario').select('*').order('ordem');
      if (error) throw error;
      return (data ?? []) as CorUsuario[];
    },
  });

  const salvarLista = useMutation({
    mutationFn: async (lista: CorUsuario[]) => {
      const atuais = qc.getQueryData<CorUsuario[]>(CHAVE) ?? [];
      const idsNovos = new Set(lista.map((c) => c.id));
      const removidos = atuais.filter((c) => !idsNovos.has(c.id)).map((c) => c.id);
      if (removidos.length > 0) {
        const { error } = await supabase.from('cores_usuario').delete().in('id', removidos);
        if (error) throw error;
      }
      if (lista.length > 0) {
        const { error } = await supabase
          .from('cores_usuario')
          .upsert(lista.map((c, i) => ({ id: c.id, hex: c.hex, label: c.label, ordem: i })), { onConflict: 'id' });
        if (error) throw error;
      }
    },
    onMutate: (lista) => {
      const anterior = qc.getQueryData<CorUsuario[]>(CHAVE);
      qc.setQueryData(CHAVE, lista.map((c, i) => ({ ...c, ordem: i })));
      return { anterior };
    },
    onError: (_erro, _lista, contexto) => {
      if (contexto?.anterior) qc.setQueryData(CHAVE, contexto.anterior);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CHAVE }),
  });

  // Importação única das cores do localStorage antigo, quando o Supabase ainda está vazio.
  const importou = useRef(false);
  useEffect(() => {
    if (importou.current || !consulta.isSuccess) return;
    importou.current = true;
    if (consulta.data.length > 0) return;
    try {
      const bruto = localStorage.getItem(CHAVE_LOCAL_ANTIGA);
      const antigas = bruto ? (JSON.parse(bruto) as { id?: string; hex: string; label?: string }[]) : [];
      if (antigas.length === 0) return;
      const lista = antigas.map((c, i) => ({ id: crypto.randomUUID(), hex: c.hex, label: c.label ?? '', ordem: i }));
      salvarLista.mutate(lista, { onSuccess: () => localStorage.removeItem(CHAVE_LOCAL_ANTIGA) });
    } catch {
      // localStorage indisponível ou conteúdo inválido: segue sem importar.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta.isSuccess]);

  return { cores: consulta.data ?? [], isLoading: consulta.isLoading, isError: consulta.isError, erro: consulta.error, salvarLista: salvarLista.mutate };
}
