import { describe, expect, it } from 'vitest';
import { somarMeses, formatarCompetenciaExtenso, competenciaParaSigla, formatarMoeda, ultimoDiaDaCompetencia } from './datas';

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

describe('ultimoDiaDaCompetencia', () => {
  it('respeita meses de 30 e 31 dias', () => {
    expect(ultimoDiaDaCompetencia('2026-11')).toBe('2026-11-30');
    expect(ultimoDiaDaCompetencia('2026-12')).toBe('2026-12-31');
  });

  it('respeita fevereiro, inclusive em ano bissexto', () => {
    expect(ultimoDiaDaCompetencia('2026-02')).toBe('2026-02-28');
    expect(ultimoDiaDaCompetencia('2028-02')).toBe('2028-02-29');
  });
});
