import { MutationCache } from '@tanstack/react-query';
import { caminhoSemBase, chaveDaRota, MENSAGEM_SEM_PERMISSAO_PARA_EDITAR, podeEditarAba, type Permissoes } from './permissoesAbas';

/**
 * Permissões de quem está usando o app, guardadas fora do React para a trava de gravação
 * (MutationCache) consultar sem depender de hook. Quem atualiza é a GuardaDePermissao.
 */
interface EstadoPermissoes {
  pronto: boolean;
  admin: boolean;
  permissoes: Permissoes;
}

let atual: EstadoPermissoes = { pronto: false, admin: false, permissoes: {} };

export function definirPermissoesAtuais(estado: EstadoPermissoes): void {
  atual = estado;
}

/** Motivo para recusar uma gravação feita na tela em que o usuário está, ou null se pode gravar. Endereços fora de qualquer aba não são travados. */
export function motivoRecusaDeGravacao(caminho: string, base: string): string | null {
  const chave = chaveDaRota(caminhoSemBase(caminho, base));
  if (!chave) return null;
  if (!atual.pronto) return 'Ainda carregando suas permissões. Tente de novo em instantes.';
  return podeEditarAba(atual.permissoes, atual.admin, chave) ? null : MENSAGEM_SEM_PERMISSAO_PARA_EDITAR;
}

/**
 * Cache de gravações que recusa, antes de qualquer outra coisa, a feita numa aba sem permissão de editar.
 * Roda para todas as gravações, inclusive as que têm o próprio `onMutate` (as que funcionam offline).
 */
export function criarMutationCachePermissoes(caminhoAtual: () => string, base: string): MutationCache {
  return new MutationCache({
    onMutate: () => {
      const motivo = motivoRecusaDeGravacao(caminhoAtual(), base);
      if (motivo) throw new Error(motivo);
    },
  });
}
