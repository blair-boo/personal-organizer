/**
 * Limite de tempo das chamadas ao Supabase. Sem ele, um fetch que nunca responde
 * (rede que cai no meio, aba em segundo plano no iPhone) deixa a tela em
 * "Carregando…" para sempre. Só dados e login ganham o teto; uploads e downloads
 * do Storage ficam de fora, porque podem demorar mais em conexão lenta.
 */
export const TEMPO_MAXIMO_REQUISICAO_MS = 30_000;

function alvoDaRequisicao(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}

export function criarFetchComLimite(limiteMs = TEMPO_MAXIMO_REQUISICAO_MS) {
  return function fetchComLimite(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const alvo = alvoDaRequisicao(input);
    if (!alvo.includes('/rest/v1/') && !alvo.includes('/auth/v1/')) return fetch(input, init);
    const limite = AbortSignal.timeout(limiteMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, limite]) : limite;
    return fetch(input, { ...init, signal });
  };
}
