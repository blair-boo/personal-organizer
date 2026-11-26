import { useCallback, useMemo } from 'react';
import { nomeDoUsuario, pessoaDoUsuario } from '../lib/usuarios';
import { useDocumentosPessoas } from './useDocumentos';
import { usePerfis } from './useUsuarios';

/**
 * Nome de cada login para mostrar na tela: o da pessoa ligada ao login (Documentos > Pessoais) ou,
 * sem ligação, o e-mail (mesma regra de Settings > Usuários). Devolve uma função: id do login -> nome.
 * Sem id, é o Conjunto.
 */
export function useNomesUsuarios(): (usuarioId: string | null | undefined) => string {
  const { data: perfis } = usePerfis();
  const { data: pessoas } = useDocumentosPessoas();

  const nomes = useMemo(
    () => new Map((perfis ?? []).map((perfil) => [perfil.usuario_id, nomeDoUsuario(perfil, pessoaDoUsuario(pessoas ?? [], perfil.usuario_id))])),
    [perfis, pessoas]
  );

  return useCallback((usuarioId) => (usuarioId ? (nomes.get(usuarioId) ?? 'Alguém') : 'Conjunto'), [nomes]);
}
