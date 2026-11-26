import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { usePermissoes } from '../hooks/usePermissoes';
import { chaveDaRota } from '../lib/permissoesAbas';
import { definirPermissoesAtuais } from '../lib/permissoesAtuais';

/**
 * Mantém a trava de gravação em dia com as permissões de quem está usando o app e só deixa abrir a aba
 * em que há permissão de ver. Vale só na interface: o banco continua aberto a qualquer login.
 */
export function GuardaDePermissao({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { pronto, erro, admin, permissoes, podeVer } = usePermissoes();

  useEffect(() => {
    definirPermissoesAtuais({ pronto, admin, permissoes });
  }, [pronto, admin, permissoes]);

  const chave = chaveDaRota(pathname);
  if (erro) return <p role="alert">Não foi possível carregar suas permissões.</p>;
  if (!pronto) return <p>Carregando…</p>;
  if (chave && !podeVer(chave)) {
    return <p className="hierarquia-vazio">Você não tem acesso a esta aba. Peça a um admin para liberar.</p>;
  }
  return <>{children}</>;
}
