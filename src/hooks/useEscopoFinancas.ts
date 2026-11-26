import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useFinancasAcessos } from './useFinancasAcessos';
import {
  PARAMETRO_ESCOPO,
  chaveDoEscopo,
  comEscopo,
  donoDoEscopo,
  escopoDoParametro,
  podeEditarEscopo,
  type EscopoFinancas,
} from '../lib/financas';
import type { FinancasAcesso } from '../types';

const SEM_ACESSOS: FinancasAcesso[] = [];

/** De quem são as finanças que a tela mostra (eu, outra pessoa ou Conjunto), lido da URL (`?de=`). */
export function useEscopoFinancas() {
  const meuId = useAuth().session?.user.id;
  const [params] = useSearchParams();
  const { data: acessos = SEM_ACESSOS } = useFinancasAcessos();
  const valor = params.get(PARAMETRO_ESCOPO);

  return useMemo(() => {
    const escopo: EscopoFinancas = escopoDoParametro(valor, meuId);
    return {
      escopo,
      meuId,
      chave: chaveDoEscopo(escopo),
      /** Dono das contas do escopo; nulo no Conjunto. */
      donoId: donoDoEscopo(escopo, meuId),
      podeEditar: podeEditarEscopo(escopo, meuId, acessos),
      /** Mantém o escopo ao navegar para outro caminho de Finanças. */
      caminho: (c: string) => comEscopo(c, escopo),
    };
  }, [valor, meuId, acessos]);
}
