import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { chaveFicaOffline, consultaFicaOffline, criarPersisterIdb, VALIDADE_OFFLINE_MS } from './persistencia';

const sucesso = { status: 'success' } as const;

describe('consultaFicaOffline', () => {
  it('guarda Apartamento, Documentos e o que desenha a interface', () => {
    for (const nome of ['itens', 'projetos', 'tarefas_manutencao', 'documentos', 'documento_campos', 'documento_anexos', 'abas_config', 'icones_usos']) {
      expect(consultaFicaOffline({ queryKey: [nome], state: sucesso as never })).toBe(true);
    }
  });

  it('não guarda Finanças, backup nem consultas desconhecidas', () => {
    for (const nome of ['lancamentos', 'contas', 'categorias', 'importacoes', 'regras_categorizacao', 'backup_status', 'qualquer_coisa']) {
      expect(consultaFicaOffline({ queryKey: [nome], state: sucesso as never })).toBe(false);
    }
  });

  it('só guarda consulta que deu certo', () => {
    expect(consultaFicaOffline({ queryKey: ['itens'], state: { status: 'error' } as never })).toBe(false);
    expect(consultaFicaOffline({ queryKey: ['itens'], state: { status: 'pending' } as never })).toBe(false);
  });
});

describe('chaveFicaOffline', () => {
  it('olha só o primeiro elemento da chave', () => {
    expect(chaveFicaOffline(['documentos', 'pessoais', null])).toBe(true);
    expect(chaveFicaOffline(['lancamentos', 1])).toBe(false);
    expect(chaveFicaOffline([])).toBe(false);
  });
});

describe('criarPersisterIdb', () => {
  it('grava, restaura e apaga, preservando Map e Date', async () => {
    const persister = criarPersisterIdb();
    const cliente = {
      timestamp: 123,
      buster: 'v1',
      clientState: {
        mutations: [],
        queries: [{ queryKey: ['item_tags'], queryHash: 'h', state: { data: new Map([['a', [{ id: 1 }]]]), dataUpdatedAt: new Date('2026-10-09T10:00:00Z') } }],
      },
    };
    await persister.persistClient(cliente as never);
    const lido = (await persister.restoreClient()) as unknown as typeof cliente;
    const dados = lido.clientState.queries[0].state.data;
    expect(dados).toBeInstanceOf(Map);
    expect(dados.get('a')).toEqual([{ id: 1 }]);
    expect(lido.clientState.queries[0].state.dataUpdatedAt).toBeInstanceOf(Date);

    await persister.removeClient();
    expect(await persister.restoreClient()).toBeUndefined();
  });
});

describe('VALIDADE_OFFLINE_MS', () => {
  it('cabe num setTimeout (acima de 2^31 - 1 ms o react-query descarta as consultas na hora)', () => {
    expect(VALIDADE_OFFLINE_MS).toBeLessThanOrEqual(2 ** 31 - 1);
    expect(VALIDADE_OFFLINE_MS).toBeGreaterThan(7 * 24 * 60 * 60 * 1000);
  });
});
