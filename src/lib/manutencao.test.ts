import { describe, expect, it } from 'vitest';
import { ocorrenciasNoIntervalo, proximaExecucao } from './manutencao';

describe('proximaExecucao', () => {
  it('usa hoje quando nunca foi executada', () => {
    const hoje = new Date().toISOString().slice(0, 10);
    expect(proximaExecucao({ ultima_execucao: null, frequencia_dias: 30 })).toBe(hoje);
  });

  it('soma a frequência à última execução', () => {
    expect(proximaExecucao({ ultima_execucao: '2026-01-01', frequencia_dias: 30 })).toBe('2026-01-31');
  });
});

describe('ocorrenciasNoIntervalo', () => {
  it('lista todas as ocorrências semanais dentro do mês', () => {
    const ocorrencias = ocorrenciasNoIntervalo({ ultima_execucao: '2026-01-01', frequencia_dias: 7 }, '2026-01-01', '2026-01-31');
    expect(ocorrencias).toEqual(['2026-01-08', '2026-01-15', '2026-01-22', '2026-01-29']);
  });

  it('retorna vazio quando a próxima ocorrência é depois do intervalo', () => {
    const ocorrencias = ocorrenciasNoIntervalo({ ultima_execucao: '2026-01-01', frequencia_dias: 365 }, '2026-01-01', '2026-01-31');
    expect(ocorrencias).toEqual([]);
  });
});
