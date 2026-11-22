import { describe, expect, it } from 'vitest';
import { aceitaDiaDaSemana, alternarDia, resumoDosDias } from './diasSemana';

describe('diasSemana', () => {
  it('liga e desliga um dia mantendo a ordem', () => {
    expect(alternarDia([0], 4)).toEqual([0, 4]);
    expect(alternarDia([4], 0)).toEqual([0, 4]);
    expect(alternarDia([0, 4], 0)).toEqual([4]);
    expect(alternarDia([], 6)).toEqual([6]);
  });

  it('resume os dias em ordem', () => {
    expect(resumoDosDias([4, 0])).toBe('Seg, Sex');
    expect(resumoDosDias([])).toBe('');
  });

  it('só semanal aceita dia da semana', () => {
    expect(aceitaDiaDaSemana(7)).toBe(true);
    expect(aceitaDiaDaSemana(30)).toBe(false);
  });
});
