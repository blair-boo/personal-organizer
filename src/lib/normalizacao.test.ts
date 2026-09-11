import { describe, expect, it } from 'vitest';
import { normalizarDescricao } from './normalizacao';

describe('normalizarDescricao', () => {
  it('remove acentos e caixa', () => {
    expect(normalizarDescricao('Pão de Açúcar')).toBe('pao de acucar');
  });

  it('remove parcela no final', () => {
    expect(normalizarDescricao('AMAZON 01/12')).toBe('amazon');
    expect(normalizarDescricao('NETFLIX 3/6')).toBe('netflix');
  });

  it('mantém iguais duas parcelas diferentes da mesma compra', () => {
    expect(normalizarDescricao('LOJA XPTO 01/12')).toBe(normalizarDescricao('LOJA XPTO 02/12'));
  });

  it('colapsa espaços múltiplos', () => {
    expect(normalizarDescricao('UBER   *TRIP   HELP.UBER.COM')).toBe('uber *trip help.uber.com');
  });
});
