import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  caminhoLocalSeguro,
  chavesAApagar,
  deveGravarMensal,
  deveLimparArquivos,
  limpezaSegura,
  montarStatus,
  planejarStorage,
  tabelasDoOpenApi,
} from './backup-supabase.mjs';

describe('retenção do backup', () => {
  it('mantém as 4 mais novas', () => {
    const chaves = ['2026-09-06', '2026-08-30', '2026-09-27', '2026-09-13', '2026-09-20'];
    expect(chavesAApagar(chaves)).toEqual(['2026-08-30']);
  });

  it('não apaga nada com 4 ou menos', () => {
    expect(chavesAApagar(['2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27'])).toEqual([]);
    expect(chavesAApagar([])).toEqual([]);
  });

  it('semanal e mensal são podados separadamente, sem se misturar', () => {
    const semanais = ['2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27', '2026-10-04'];
    const mensais = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
    expect(chavesAApagar(semanais)).toEqual(['2026-09-06']);
    expect(chavesAApagar(mensais)).toEqual(['2026-06']);
  });

  it('não altera o array recebido', () => {
    const chaves = ['2026-09-27', '2026-09-06', '2026-09-13', '2026-09-20', '2026-10-04'];
    chavesAApagar(chaves);
    expect(chaves[0]).toBe('2026-09-27');
  });
});

describe('quando gravar o mensal e limpar arquivos', () => {
  it('mensal só no primeiro domingo do mês', () => {
    expect(deveGravarMensal(new Date('2026-10-04T06:00:00Z'))).toBe(true);
    expect(deveGravarMensal(new Date('2026-10-07T06:00:00Z'))).toBe(true);
    expect(deveGravarMensal(new Date('2026-10-11T06:00:00Z'))).toBe(false);
    expect(deveGravarMensal(new Date('2026-10-25T06:00:00Z'))).toBe(false);
  });

  it('limpeza só em janeiro e julho, no começo do mês', () => {
    expect(deveLimparArquivos(new Date('2027-01-03T06:00:00Z'))).toBe(true);
    expect(deveLimparArquivos(new Date('2026-07-05T06:00:00Z'))).toBe(true);
    expect(deveLimparArquivos(new Date('2027-01-10T06:00:00Z'))).toBe(false);
    expect(deveLimparArquivos(new Date('2026-10-04T06:00:00Z'))).toBe(false);
  });
});

describe('trava de segurança da limpeza', () => {
  it('recusa listagem vazia ou com queda grande', () => {
    expect(limpezaSegura(0, 500)).toBe(false);
    expect(limpezaSegura(0, 0)).toBe(false);
    expect(limpezaSegura(200, 500)).toBe(false);
  });

  it('aceita listagem plausível', () => {
    expect(limpezaSegura(250, 500)).toBe(true);
    expect(limpezaSegura(480, 500)).toBe(true);
    expect(limpezaSegura(10, 5)).toBe(true);
  });
});

describe('plano incremental do Storage', () => {
  it('baixa só o que falta ou mudou de tamanho e lista órfãos', () => {
    const supabase = { 'a.jpg': 10, 'b.jpg': 20, 'novo.jpg': 5 };
    const r2 = { 'a.jpg': 10, 'b.jpg': 99, 'velho.jpg': 7 };
    expect(planejarStorage(supabase, r2)).toEqual({ baixar: ['b.jpg', 'novo.jpg'], orfaos: ['velho.jpg'] });
  });

  it('não repete nada quando R2 já está igual', () => {
    expect(planejarStorage({ 'a.jpg': 1 }, { 'a.jpg': 1 })).toEqual({ baixar: [], orfaos: [] });
  });
});

describe('caminhoLocalSeguro', () => {
  const raiz = path.resolve('/tmp/raiz');

  it('aceita caminhos dentro da pasta', () => {
    expect(caminhoLocalSeguro(raiz, 'pasta/doc.pdf')).toBe(path.join(raiz, 'pasta/doc.pdf'));
  });

  it('bloqueia tentativas de escapar da pasta', () => {
    expect(caminhoLocalSeguro(raiz, '../fora.txt')).toBeNull();
    expect(caminhoLocalSeguro(raiz, 'a/../../fora.txt')).toBeNull();
    expect(caminhoLocalSeguro(raiz, '/etc/passwd')).toBeNull();
  });
});

describe('tabelasDoOpenApi', () => {
  const spec = {
    definitions: {
      lancamentos: {
        properties: {
          id: { description: 'Note:\nThis is a Primary Key.<pk/>', type: 'string' },
          valor: { type: 'number' },
        },
      },
      item_tags: {
        properties: {
          item_id: { description: 'Note:\nThis is a Primary Key.<pk/>' },
          tag_id: { description: 'Note:\nThis is a Primary Key.<pk/>' },
        },
      },
      visao_sem_pk: { properties: { b: {}, a: {} } },
      vazia: { properties: {} },
    },
  };

  it('usa a chave primária, inclusive composta', () => {
    const tabelas = tabelasDoOpenApi(spec);
    expect(tabelas.lancamentos).toEqual(['id']);
    expect(tabelas.item_tags).toEqual(['item_id', 'tag_id']);
  });

  it('sem chave primária, ordena por todas as colunas; ignora definições sem colunas', () => {
    const tabelas = tabelasDoOpenApi(spec);
    expect(tabelas.visao_sem_pk).toEqual(['b', 'a']);
    expect(tabelas).not.toHaveProperty('vazia');
  });

  it('spec vazia ou ausente não quebra', () => {
    expect(tabelasDoOpenApi({})).toEqual({});
    expect(tabelasDoOpenApi(undefined)).toEqual({});
  });
});

describe('montarStatus', () => {
  it('ordena semanais antes dos mensais, do mais novo ao mais antigo', () => {
    const snapshots = [
      { tipo: 'mensal', nome: '2026-09', tamanho_bytes: 1, linhas: 1 },
      { tipo: 'semanal', nome: '2026-09-20', tamanho_bytes: 1, linhas: 1 },
      { tipo: 'mensal', nome: '2026-10', tamanho_bytes: 1, linhas: 1 },
      { tipo: 'semanal', nome: '2026-10-04', tamanho_bytes: 1, linhas: 1 },
    ];
    const status = montarStatus(snapshots, [1000, 7], 100, [900, 6]);
    expect(status.snapshots.map((b) => `${b.tipo}:${b.nome}`)).toEqual([
      'semanal:2026-10-04',
      'semanal:2026-09-20',
      'mensal:2026-10',
      'mensal:2026-09',
    ]);
    expect(status.id).toBe(1);
    expect([status.tamanho_total_bytes, status.tamanho_db_bytes]).toEqual([1000, 100]);
    expect([status.tamanho_arquivos_bytes, status.objetos_arquivos]).toEqual([900, 6]);
  });
});
