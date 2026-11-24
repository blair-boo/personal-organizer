import { describe, expect, it } from 'vitest';
import { adiamentosDaTarefa, adiamentoVigente, vezesAdiadaDesdeUltimaExecucao } from './adiamentos';
import type { AdiamentoTarefa } from '../types';

const a = (id: string, criado_em: string, extra: Partial<AdiamentoTarefa> = {}): AdiamentoTarefa => ({
  id,
  tarefa_id: 't1',
  tipo: 'adiada',
  data_anterior: null,
  adiada_para: '2026-12-01',
  pessoa_id: null,
  observacao: null,
  criado_em,
  ...extra,
});

describe('adiamentos', () => {
  it('filtra pela tarefa e ordena do mais recente para o mais antigo', () => {
    const lista = [a('1', '2026-11-01T10:00:00Z'), a('2', '2026-11-03T10:00:00Z'), a('3', '2026-11-02T10:00:00Z', { tarefa_id: 't2' })];
    expect(adiamentosDaTarefa(lista, 't1').map((x) => x.id)).toEqual(['2', '1']);
  });

  it('o vigente é o mais recente, se a data bate com a da tarefa', () => {
    const lista = adiamentosDaTarefa([a('1', '2026-11-01T10:00:00Z'), a('2', '2026-11-03T10:00:00Z', { adiada_para: '2026-12-05' })], 't1');
    expect(adiamentoVigente(lista, '2026-12-05')?.id).toBe('2');
    expect(adiamentoVigente(lista, '2026-12-01')).toBeNull();
    expect(adiamentoVigente(lista, null)).toBeNull();
  });

  it('adiamento cancelado nunca é o vigente', () => {
    const lista = adiamentosDaTarefa([a('1', '2026-11-01T10:00:00Z'), a('2', '2026-11-03T10:00:00Z', { tipo: 'cancelada', adiada_para: null })], 't1');
    expect(adiamentoVigente(lista, '2026-12-01')).toBeNull();
  });

  it('conta só adiamentos depois da última execução e ignora cancelamentos', () => {
    const lista = adiamentosDaTarefa(
      [a('1', '2026-10-01T10:00:00Z'), a('2', '2026-11-03T10:00:00Z'), a('3', '2026-11-05T10:00:00Z', { tipo: 'pulada' }), a('4', '2026-11-06T10:00:00Z', { tipo: 'cancelada' })],
      't1'
    );
    expect(vezesAdiadaDesdeUltimaExecucao(lista, '2026-10-15')).toBe(2);
    expect(vezesAdiadaDesdeUltimaExecucao(lista, null)).toBe(3);
  });
});
