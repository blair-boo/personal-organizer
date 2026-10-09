import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const obterUrlAssinada = vi.fn();
vi.mock('../storage', () => ({ obterUrlAssinada: (...args: unknown[]) => obterUrlAssinada(...args) }));
const lerArquivo = vi.fn();
vi.mock('./arquivos', () => ({ lerArquivo: (...args: unknown[]) => lerArquivo(...args) }));

const { obterBlobDoArquivo, obterUrlParaAbrir } = await import('./abrirArquivo');

beforeEach(() => {
  obterUrlAssinada.mockReset();
  lerArquivo.mockReset();
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:local', revokeObjectURL: () => {} });
});
afterEach(() => vi.unstubAllGlobals());

describe('obterUrlParaAbrir', () => {
  it('com internet usa a URL assinada', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    obterUrlAssinada.mockResolvedValue('https://assinada');
    expect(await obterUrlParaAbrir('confidencial', 'a.pdf', 60)).toBe('https://assinada');
    expect(obterUrlAssinada).toHaveBeenCalledWith('confidencial', 'a.pdf', 60);
    expect(lerArquivo).not.toHaveBeenCalled();
  });

  it('sem internet abre a cópia guardada, sem tentar a rede', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    lerArquivo.mockResolvedValue(new Blob(['x']));
    expect(await obterUrlParaAbrir('confidencial', 'a.pdf')).toBe('blob:local');
    expect(obterUrlAssinada).not.toHaveBeenCalled();
  });

  it('sem internet e sem cópia, avisa que precisa abrir uma vez com internet', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    lerArquivo.mockResolvedValue(null);
    await expect(obterUrlParaAbrir('confidencial', 'a.pdf')).rejects.toThrow('Abra-o uma vez com internet');
  });

  it('se a URL assinada falhar com internet, cai pra cópia guardada', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    obterUrlAssinada.mockRejectedValue(new Error('Failed to fetch'));
    lerArquivo.mockResolvedValue(new Blob(['x']));
    expect(await obterUrlParaAbrir('confidencial', 'a.pdf')).toBe('blob:local');
  });

  it('se falhar e não houver cópia, devolve o erro original', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    obterUrlAssinada.mockRejectedValue(new Error('Failed to fetch'));
    lerArquivo.mockResolvedValue(null);
    await expect(obterUrlParaAbrir('confidencial', 'a.pdf')).rejects.toThrow('Failed to fetch');
  });
});

describe('obterBlobDoArquivo', () => {
  it('com internet baixa pela URL assinada', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    obterUrlAssinada.mockResolvedValue('https://assinada');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('conteudo')));
    const blob = await obterBlobDoArquivo('b', 'c.pdf');
    expect(await blob.text()).toBe('conteudo');
  });

  it('se o download falhar, usa a cópia guardada', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    obterUrlAssinada.mockResolvedValue('https://assinada');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('erro', { status: 500 })));
    lerArquivo.mockResolvedValue(new Blob(['local']));
    expect(await (await obterBlobDoArquivo('b', 'c.pdf')).text()).toBe('local');
  });

  it('sem internet e sem cópia, avisa', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    lerArquivo.mockResolvedValue(null);
    await expect(obterBlobDoArquivo('b', 'c.pdf')).rejects.toThrow('Abra-o uma vez com internet');
  });
});
