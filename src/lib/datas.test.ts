import { describe, expect, it } from 'vitest';
import { somarMeses, formatarCompetenciaExtenso, competenciaParaSigla, formatarMoeda } from './datas';

describe('somarMeses', () => {
  it('avança dentro do mesmo ano', () => {
    expect(somarMeses('2026-01', 1)).toBe('2026-02');
  });

  it('vira o ano ao avançar em dezembro', () => {
    expect(somarMeses('2026-12', 1)).toBe('2027-01');
  });

  it('volta o ano ao retroceder em janeiro', () => {
    expect(somarMeses('2026-01', -1)).toBe('2025-12');
  });
});

describe('formatarCompetenciaExtenso', () => {
  it('formata mês e ano por extenso', () => {
    expect(formatarCompetenciaExtenso('2026-01')).toBe('Janeiro de 2026');
  });
});

describe('competenciaParaSigla', () => {
  it('reduz o ano para 2 dígitos', () => {
    expect(competenciaParaSigla('2026-01')).toBe('26-01');
  });
});

describe('formatarMoeda', () => {
  it('formata em real brasileiro', () => {
    expect(formatarMoeda(1234.5)).toContain('1.234,50');
  });
});
