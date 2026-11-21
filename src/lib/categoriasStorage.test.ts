import { describe, expect, it } from 'vitest';
import { contarItensPorCategoria, moverCategoria, nomeDeCategoriaDuplicado } from './categoriasStorage';
import type { CategoriaStorage, ItemStorage } from '../types';

const categorias: CategoriaStorage[] = [
  { id: 'k1', nome: 'Louça', ordem: 1 },
  { id: 'k2', nome: 'Ferramenta', ordem: 2 },
];

describe('nomeDeCategoriaDuplicado', () => {
  it('ignora maiúscula, acento e espaços nas pontas', () => {
    expect(nomeDeCategoriaDuplicado('louca', categorias)).toBe(true);
    expect(nomeDeCategoriaDuplicado('  FERRAMENTA ', categorias)).toBe(true);
    expect(nomeDeCategoriaDuplicado('Roupa', categorias)).toBe(false);
  });

  it('não conta a própria classificação ao renomear', () => {
    expect(nomeDeCategoriaDuplicado('Louça', categorias, 'k1')).toBe(false);
    expect(nomeDeCategoriaDuplicado('Louça', categorias, 'k2')).toBe(true);
  });
});

describe('contarItensPorCategoria', () => {
  it('conta só itens com classificação', () => {
    const itens = [
      { id: 'a', categoria_id: 'k1' },
      { id: 'b', categoria_id: 'k1' },
      { id: 'c', categoria_id: null },
      { id: 'd', categoria_id: 'k2' },
    ] as ItemStorage[];
    expect(contarItensPorCategoria(itens)).toEqual(new Map([['k1', 2], ['k2', 1]]));
  });
});

describe('moverCategoria', () => {
  it('põe a classificação na posição da outra, para cima e para baixo', () => {
    expect(moverCategoria(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a']);
    expect(moverCategoria(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
  });

  it('não muda nada com ids iguais ou desconhecidos', () => {
    const ids = ['a', 'b'];
    expect(moverCategoria(ids, 'a', 'a')).toBe(ids);
    expect(moverCategoria(ids, 'x', 'a')).toBe(ids);
  });
});
