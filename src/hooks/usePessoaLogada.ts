import { useAuth } from '../auth/AuthContext';
import { useDocumentosPessoas } from './useDocumentos';
import type { PessoaDocumentos } from '../types';

/** A pessoa (de Documentos > Pessoais) ligada ao login de quem está usando o app; null se o login ainda não está ligado a ninguém. */
export function usePessoaLogada(): PessoaDocumentos | null {
  const { session } = useAuth();
  const { data: pessoas } = useDocumentosPessoas();
  const usuarioId = session?.user.id;
  if (!usuarioId) return null;
  return (pessoas ?? []).find((p) => p.tipo === 'pessoa' && p.usuario_id === usuarioId) ?? null;
}
