import { useSyncExternalStore } from 'react';

function assinar(aviso: () => void): () => void {
  window.addEventListener('online', aviso);
  window.addEventListener('offline', aviso);
  return () => {
    window.removeEventListener('online', aviso);
    window.removeEventListener('offline', aviso);
  };
}

/** true quando o navegador acha que há internet. Não garante que o servidor responde: falha de rede continua tratada onde acontece. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    assinar,
    () => navigator.onLine,
    () => true
  );
}
