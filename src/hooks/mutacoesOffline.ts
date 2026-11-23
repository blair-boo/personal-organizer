import type { QueryClient } from '@tanstack/react-query';

/** Usar como `onMutate`: a mutação funciona sem internet (a fila cuida), então não pode ser recusada como as demais. */
export const SEM_BLOQUEIO_OFFLINE = () => undefined;

/** Depois de gravar: se foi direto ao servidor, busca as consultas de novo; se ficou na fila, a tela já mostra o resultado. */
export function aposGravar(qc: QueryClient, chaves: (readonly unknown[])[]) {
  return (resultado: 'enviada' | 'enfileirada') => (resultado === 'enviada' ? Promise.all(chaves.map((queryKey) => qc.invalidateQueries({ queryKey }))) : undefined);
}
