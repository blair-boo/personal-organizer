import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { contarFila, enfileirar, limparFila, listarFila, removerDaFila } from './fila';
import { enviarFila } from './enviarFila';

beforeEach(async () => {
  await limparFila();
});

describe('fila', () => {
  it('guarda as alterações na ordem em que foram feitas', async () => {
    await enfileirar('storage.salvarCaixa', { n: 1 });
    await enfileirar('manutencao.excluirExecucao', { n: 2 });
    const fila = await listarFila();
    expect(fila.map((o) => o.tipo)).toEqual(['storage.salvarCaixa', 'manutencao.excluirExecucao']);
    expect(fila.map((o) => (o.dados as { n: number }).n)).toEqual([1, 2]);
    expect(await contarFila()).toBe(2);
  });

  it('várias alterações ao mesmo tempo não se perdem', async () => {
    await Promise.all(Array.from({ length: 10 }, (_, n) => enfileirar('storage.aplicarEdicao', { n })));
    expect(await contarFila()).toBe(10);
  });

  it('remove uma e limpa tudo', async () => {
    const a = await enfileirar('storage.salvarCaixa', {});
    await enfileirar('storage.salvarCaixa', {});
    await removerDaFila(a.id);
    expect(await contarFila()).toBe(1);
    await limparFila();
    expect(await contarFila()).toBe(0);
  });

  it('aceita arquivos (Blob) nos dados', async () => {
    await enfileirar('storage.salvarCaixa', { foto: new Blob(['abc'], { type: 'image/png' }) });
    const [operacao] = await listarFila();
    expect((operacao.dados as { foto: Blob }).foto.size).toBe(3);
  });
});

describe('enviarFila', () => {
  const texto = (e: unknown) => String(e);

  it('envia na ordem e esvazia a fila', async () => {
    await enfileirar('storage.salvarCaixa', { n: 1 });
    await enfileirar('storage.aplicarEdicao', { n: 2 });
    const vistos: number[] = [];
    const resultado = await enviarFila(async (o) => void vistos.push((o.dados as { n: number }).n), texto);
    expect(resultado).toEqual({ enviadas: 2, erro: null });
    expect(vistos).toEqual([1, 2]);
    expect(await contarFila()).toBe(0);
  });

  it('para na que falhou e mantém ela e as seguintes na fila', async () => {
    await enfileirar('storage.salvarCaixa', { n: 1 });
    await enfileirar('storage.aplicarEdicao', { n: 2 });
    await enfileirar('manutencao.excluirExecucao', { n: 3 });
    const executar = vi.fn(async (o: { dados: unknown }) => {
      if ((o.dados as { n: number }).n === 2) throw new Error('falhou');
    });
    const resultado = await enviarFila(executar, (e) => (e as Error).message);
    expect(resultado).toEqual({ enviadas: 1, erro: 'falhou' });
    expect(executar).toHaveBeenCalledTimes(2);
    expect((await listarFila()).map((o) => (o.dados as { n: number }).n)).toEqual([2, 3]);
  });

  it('duas chamadas ao mesmo tempo dividem o mesmo envio', async () => {
    await enfileirar('storage.salvarCaixa', { n: 1 });
    const executar = vi.fn(async () => undefined);
    const [a, b] = await Promise.all([enviarFila(executar, texto), enviarFila(executar, texto)]);
    expect(executar).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('fila vazia não faz nada', async () => {
    expect(await enviarFila(async () => undefined, texto)).toEqual({ enviadas: 0, erro: null });
  });
});
