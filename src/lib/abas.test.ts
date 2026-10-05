import { describe, expect, it } from 'vitest';
import { nomeVazioInvalido, resolverAbas } from './abas';

describe('resolverAbas', () => {
  it('mantém a ordem e os nomes padrão sem configuração', () => {
    const abas = resolverAbas('apartamento', []);
    expect(abas.map((a) => a.nome)).toEqual(['Itens', 'Projetos', 'Manutenção']);
  });

  it('aplica nome e ordem salvos', () => {
    const abas = resolverAbas('apartamento', [
      { chave: 'apartamento:manutencao', nome: 'Reparos', ordem: 0 },
      { chave: 'apartamento:itens', nome: null, ordem: 1 },
      { chave: 'apartamento:projetos', nome: '', ordem: 2 },
    ]);
    expect(abas.map((a) => a.chave)).toEqual(['apartamento:manutencao', 'apartamento:itens', 'apartamento:projetos']);
    expect(abas.map((a) => a.nome)).toEqual(['Reparos', 'Itens', '']);
  });
});

describe('nomeVazioInvalido', () => {
  it('exige nome quando não há ícone', () => {
    expect(nomeVazioInvalido('', false)).toBe(true);
    expect(nomeVazioInvalido('  ', false)).toBe(true);
    expect(nomeVazioInvalido('', true)).toBe(false);
    expect(nomeVazioInvalido('Itens', false)).toBe(false);
  });
});
