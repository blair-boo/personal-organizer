import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabaseClient';
import type { Conta, FormatoCartao, StatusConta, SubtipoVirtualCartao, TipoConta } from '../types';

const QUERY_KEY = ['contas'];

type ContaDoBanco = Omit<Conta, 'donos'> & { contas_donos: { usuario_id: string }[] | null };

/** Todas as contas que a RLS deixa eu ver (minhas, conjuntas e de quem liberou). O escopo filtra depois, em `contasDoEscopo`. */
export function useContas() {
  const meuId = useAuth().session?.user.id;
  return useQuery({
    queryKey: [...QUERY_KEY, meuId],
    enabled: !!meuId,
    queryFn: async () => {
      const { data, error } = await supabase.from('contas').select('*, contas_donos(usuario_id)').order('nome');
      if (error) throw error;
      return (data as ContaDoBanco[]).map(({ contas_donos, ...conta }) => ({
        ...conta,
        donos: (contas_donos ?? []).map((d) => d.usuario_id),
      })) as Conta[];
    },
  });
}

export interface DadosConta {
  nome: string | null;
  tipo: TipoConta;
  instituicao: string;
  cor: string | null;
  status: StatusConta;
  conta_vinculada_id: string | null;
  emissora: string | null;
  ultimos_4_digitos: string | null;
  formato: FormatoCartao | null;
  subtipo_virtual: SubtipoVirtualCartao | null;
  valor_deposito_mensal: number | null;
  dia_deposito: number | null;
  dono_id: string;
  conjunta: boolean;
  /** Logins donos de uma conta conjunta (inclui o dono_id). Ignorado quando a conta não é conjunta. */
  donos: string[];
}

/** Deixa contas_donos igual à lista: conta individual não tem linhas ali. */
async function sincronizarDonos(contaId: string, conjunta: boolean, donos: string[]) {
  const desejados = conjunta ? [...new Set(donos)] : [];
  const { data, error } = await supabase.from('contas_donos').select('usuario_id').eq('conta_id', contaId);
  if (error) throw error;
  const atuais = (data ?? []).map((d) => d.usuario_id as string);
  const remover = atuais.filter((id) => !desejados.includes(id));
  const incluir = desejados.filter((id) => !atuais.includes(id));
  if (remover.length > 0) {
    const { error: erroRemover } = await supabase.from('contas_donos').delete().eq('conta_id', contaId).in('usuario_id', remover);
    if (erroRemover) throw erroRemover;
  }
  if (incluir.length > 0) {
    const { error: erroIncluir } = await supabase.from('contas_donos').insert(incluir.map((usuario_id) => ({ conta_id: contaId, usuario_id })));
    if (erroIncluir) throw erroIncluir;
  }
}

export function useCriarConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ donos, ...dados }: DadosConta) => {
      // O id nasce aqui para os donos poderem ser gravados logo depois do insert.
      const id = crypto.randomUUID();
      const { error } = await supabase.from('contas').insert({ id, ...dados });
      if (error) throw error;
      await sincronizarDonos(id, dados.conjunta, donos);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useAtualizarConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: DadosConta }) => {
      const { donos, ...resto } = dados;
      const { error } = await supabase.from('contas').update(resto).eq('id', id);
      if (error) throw error;
      await sincronizarDonos(id, dados.conjunta, donos);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useExcluirConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
