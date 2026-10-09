export type ResultadoAtualizacao = 'atualizando' | 'atual' | 'indisponivel';

const ESPERA_TROCA_MS = 8_000;

/**
 * Força o navegador a reconferir o service worker (ele só faz isso sozinho de
 * tempos em tempos) e recarrega a página se uma versão nova assumir o controle.
 * O service worker gerado (registerType 'autoUpdate') já faz skipWaiting e
 * clientsClaim sozinho: faltava algo chamando update() e reagindo à troca.
 */
export async function verificarAtualizacaoApp(): Promise<ResultadoAtualizacao> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 'indisponivel';
  const registro = await navigator.serviceWorker.getRegistration();
  if (!registro) return 'indisponivel';

  const trocou = new Promise<boolean>((resolve) => {
    const limite = setTimeout(() => resolve(false), ESPERA_TROCA_MS);
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        clearTimeout(limite);
        resolve(true);
      },
      { once: true }
    );
  });

  await registro.update();
  if (!registro.installing && !registro.waiting) return 'atual';
  if (await trocou) {
    window.location.reload();
    return 'atualizando';
  }
  return 'atual';
}
