import { NOME_CACHE_ARQUIVOS } from './offline/arquivos';

/**
 * Esvazia os caches do app (os arquivos do próprio app, as respostas guardadas
 * pelo service worker e os ícones) e desregistra o service worker. NÃO apaga os
 * arquivos guardados para uso offline nem os dados do IndexedDB: isso tem botão
 * próprio (Apagar dados offline). Chamar window.location.reload() depois: o
 * service worker é registrado de novo no carregamento e refaz o cache do app.
 */
export async function limparCachesApp(): Promise<void> {
  if ('caches' in globalThis) {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter((nome) => nome !== NOME_CACHE_ARQUIVOS).map((nome) => caches.delete(nome)));
  }
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const registros = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registros.map((r) => r.unregister()));
  }
}
