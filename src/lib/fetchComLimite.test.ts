import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarFetchComLimite } from './fetchComLimite';

/** fetch falso que só termina se o sinal de cancelamento disparar. */
function fetchPendente() {
  return vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    });
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('criarFetchComLimite', () => {
  it('cancela chamadas de dados que passam do limite', async () => {
    vi.stubGlobal('fetch', fetchPendente());
    const fetchComLimite = criarFetchComLimite(20);
    await expect(fetchComLimite('https://x.supabase.co/rest/v1/contas')).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('cancela chamadas de login também', async () => {
    vi.stubGlobal('fetch', fetchPendente());
    await expect(criarFetchComLimite(20)('https://x.supabase.co/auth/v1/token')).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('não coloca limite no Storage', async () => {
    const fetchFalso = vi.fn(() => Promise.resolve(new Response('ok')));
    vi.stubGlobal('fetch', fetchFalso);
    await criarFetchComLimite(20)('https://x.supabase.co/storage/v1/object/icones/a.svg', { method: 'POST' });
    expect(fetchFalso).toHaveBeenCalledWith('https://x.supabase.co/storage/v1/object/icones/a.svg', { method: 'POST' });
  });

  it('respeita o cancelamento de quem chamou', async () => {
    vi.stubGlobal('fetch', fetchPendente());
    const controle = new AbortController();
    const promessa = criarFetchComLimite(5_000)('https://x.supabase.co/rest/v1/contas', { signal: controle.signal });
    controle.abort(new Error('cancelado por mim'));
    await expect(promessa).rejects.toThrow('cancelado por mim');
  });

  it('deixa passar respostas rápidas', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('[]'))));
    const resposta = await criarFetchComLimite(1_000)('https://x.supabase.co/rest/v1/contas');
    expect(await resposta.text()).toBe('[]');
  });
});
