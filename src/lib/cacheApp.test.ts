import { afterEach, describe, expect, it, vi } from 'vitest';
import { verificarAtualizacaoApp } from './atualizacaoApp';
import { limparCachesApp } from './cacheApp';

afterEach(() => vi.unstubAllGlobals());

describe('limparCachesApp', () => {
  it('apaga os caches do app mas preserva os arquivos guardados para uso offline', async () => {
    const apagados: string[] = [];
    vi.stubGlobal('caches', {
      keys: async () => ['workbox-precache-v2', 'supabase-api-cache', 'storage-cache', 'arquivos-offline'],
      delete: async (nome: string) => {
        apagados.push(nome);
        return true;
      },
    });
    const desregistrados: number[] = [];
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistrations: async () => [{ unregister: async () => desregistrados.push(1) }, { unregister: async () => desregistrados.push(2) }] },
    });
    await limparCachesApp();
    expect(apagados.sort()).toEqual(['storage-cache', 'supabase-api-cache', 'workbox-precache-v2']);
    expect(desregistrados).toEqual([1, 2]);
  });
});

describe('verificarAtualizacaoApp', () => {
  it('sem service worker, é indisponível', async () => {
    vi.stubGlobal('navigator', {});
    expect(await verificarAtualizacaoApp()).toBe('indisponivel');
  });

  it('sem registro, é indisponível', async () => {
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: async () => undefined } });
    expect(await verificarAtualizacaoApp()).toBe('indisponivel');
  });

  it('se não aparece versão nova, o app está atual', async () => {
    const registro = { installing: null, waiting: null, update: vi.fn(async () => undefined) };
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: async () => registro, addEventListener: vi.fn() } });
    expect(await verificarAtualizacaoApp()).toBe('atual');
    expect(registro.update).toHaveBeenCalledOnce();
  });

  it('se uma versão nova assume o controle, recarrega a página', async () => {
    const recarregar = vi.fn();
    vi.stubGlobal('window', { location: { reload: recarregar } });
    let aoTrocar: () => void = () => {};
    const registro = { installing: {}, waiting: null, update: async () => undefined };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: async () => registro,
        addEventListener: (_: string, fn: () => void) => {
          aoTrocar = fn;
        },
      },
    });
    const promessa = verificarAtualizacaoApp();
    await Promise.resolve();
    await Promise.resolve();
    aoTrocar();
    expect(await promessa).toBe('atualizando');
    expect(recarregar).toHaveBeenCalledOnce();
  });
});
