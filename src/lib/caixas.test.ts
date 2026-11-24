import { describe, expect, it } from 'vitest';
import {
  caixaDoItem,
  codigoDaCaixa,
  criarLayout,
  idsDeCaixasComTags,
  nomeDaCopia,
  tagEfetivaDoItem,
  tagsDaCaixa,
  idsDeCaixasNaBusca,
  layoutIgual,
  moverCaixa,
  moverItem,
  numeroDoCodigo,
  ordensParaSalvar,
} from './caixas';
import type { CaixaStorage, ItemStorage } from '../types';

const caixas: CaixaStorage[] = [
  { id: 'c1', numero: 1, nome: 'Cozinha', ordem: 1, tag_id: null },
  { id: 'c2', numero: 14, nome: 'Ferramentas', ordem: 2, tag_id: null },
  { id: 'c3', numero: 3, nome: 'Vazia', ordem: 3, tag_id: null },
];
const itens: ItemStorage[] = [
  { id: 'i1', storage_id: 'c1', nome: 'Panela', quantidade: 2, tag_id: null, ordem: 2 },
  { id: 'i2', storage_id: 'c1', nome: 'Colher', quantidade: null, tag_id: null, ordem: 1 },
  { id: 'i3', storage_id: 'c2', nome: 'Martelo', quantidade: 1, tag_id: null, ordem: 1 },
];

describe('codigoDaCaixa e numeroDoCodigo', () => {
  it('forma o código com três dígitos', () => {
    expect(codigoDaCaixa(14)).toBe('C-014');
    expect(codigoDaCaixa(5)).toBe('C-005');
    expect(codigoDaCaixa(1234)).toBe('C-1234');
  });

  it('lê o número de volta, ignorando maiúsculas e espaços', () => {
    expect(numeroDoCodigo('C-014')).toBe(14);
    expect(numeroDoCodigo(' c-5 ')).toBe(5);
  });

  it('recusa o que não é código de caixa', () => {
    expect(numeroDoCodigo('')).toBeNull();
    expect(numeroDoCodigo('https://exemplo.com')).toBeNull();
    expect(numeroDoCodigo('C-0')).toBeNull();
    expect(numeroDoCodigo('C-014x')).toBeNull();
  });
});

describe('criarLayout', () => {
  it('ordena os itens de cada caixa pela ordem e mantém caixa vazia', () => {
    const layout = criarLayout(caixas, itens);
    expect(layout.caixas).toEqual(['c1', 'c2', 'c3']);
    expect(layout.itens).toEqual({ c1: ['i2', 'i1'], c2: ['i3'], c3: [] });
  });
});

describe('moverCaixa', () => {
  it('põe a caixa na posição da outra', () => {
    const layout = criarLayout(caixas, itens);
    expect(moverCaixa(layout, 'c3', 'c1').caixas).toEqual(['c3', 'c1', 'c2']);
    expect(moverCaixa(layout, 'c1', 'c3').caixas).toEqual(['c2', 'c3', 'c1']);
  });

  it('não muda nada com ids desconhecidos ou iguais', () => {
    const layout = criarLayout(caixas, itens);
    expect(moverCaixa(layout, 'c1', 'c1')).toBe(layout);
    expect(moverCaixa(layout, 'x', 'c1')).toBe(layout);
  });
});

describe('moverItem', () => {
  it('reordena dentro da mesma caixa, para cima e para baixo', () => {
    const layout = criarLayout(caixas, itens);
    expect(moverItem(layout, 'i1', 'c1', 'i2').itens.c1).toEqual(['i1', 'i2']);
    expect(moverItem(layout, 'i2', 'c1', 'i1').itens.c1).toEqual(['i1', 'i2']);
    const tres = criarLayout(
      [{ id: 'c', numero: 1, nome: 'C', ordem: 1, tag_id: null }],
      ['a', 'b', 'c'].map((id, i) => ({ id, storage_id: 'c', nome: id, quantidade: null, tag_id: null, ordem: i + 1 }))
    );
    expect(moverItem(tres, 'a', 'c', 'c').itens.c).toEqual(['b', 'c', 'a']);
    expect(moverItem(tres, 'c', 'c', 'a').itens.c).toEqual(['c', 'a', 'b']);
  });

  it('leva o item para outra caixa, antes de um item ou no fim', () => {
    const layout = criarLayout(caixas, itens);
    expect(moverItem(layout, 'i2', 'c2', 'i3').itens).toEqual({ c1: ['i1'], c2: ['i2', 'i3'], c3: [] });
    expect(moverItem(layout, 'i2', 'c3').itens).toEqual({ c1: ['i1'], c2: ['i3'], c3: ['i2'] });
  });

  it('não altera o layout original', () => {
    const layout = criarLayout(caixas, itens);
    moverItem(layout, 'i2', 'c3');
    expect(layout.itens.c1).toEqual(['i2', 'i1']);
  });

  it('ignora item ou caixa que não existe', () => {
    const layout = criarLayout(caixas, itens);
    expect(moverItem(layout, 'x', 'c1')).toBe(layout);
    expect(moverItem(layout, 'i1', 'x')).toBe(layout);
  });
});

describe('caixaDoItem, layoutIgual e ordensParaSalvar', () => {
  it('acha a caixa do item', () => {
    expect(caixaDoItem(criarLayout(caixas, itens), 'i3')).toBe('c2');
    expect(caixaDoItem(criarLayout(caixas, itens), 'zzz')).toBeNull();
  });

  it('compara layouts', () => {
    const a = criarLayout(caixas, itens);
    expect(layoutIgual(a, criarLayout(caixas, itens))).toBe(true);
    expect(layoutIgual(a, moverItem(a, 'i2', 'c3'))).toBe(false);
    expect(layoutIgual(a, moverCaixa(a, 'c3', 'c1'))).toBe(false);
  });

  it('só devolve os itens que mudaram de caixa ou de posição', () => {
    const original = criarLayout(caixas, itens);
    const atual = moverItem(original, 'i2', 'c2');
    const ordens = ordensParaSalvar(original, atual);
    expect(ordens.caixas).toEqual([
      { id: 'c1', ordem: 1 },
      { id: 'c2', ordem: 2 },
      { id: 'c3', ordem: 3 },
    ]);
    // i3 não mudou; i1 subiu para a primeira posição; i2 foi para o fim de c2.
    expect(ordens.itens).toEqual([
      { id: 'i1', storage_id: 'c1', ordem: 1 },
      { id: 'i2', storage_id: 'c2', ordem: 2 },
    ]);
  });
});

describe('idsDeCaixasNaBusca', () => {
  it('sem busca devolve todas', () => {
    expect(idsDeCaixasNaBusca(caixas, itens, '  ').size).toBe(3);
  });

  it('acha pelo nome da caixa, sem acento nem maiúscula', () => {
    expect([...idsDeCaixasNaBusca(caixas, itens, 'cozinha')]).toEqual(['c1']);
    expect([...idsDeCaixasNaBusca(caixas, itens, 'FERRAMENTAS')]).toEqual(['c2']);
    expect([...idsDeCaixasNaBusca([{ id: 'c9', numero: 9, nome: 'Decoração', ordem: 1, tag_id: null }], [], 'decoracao')]).toEqual(['c9']);
  });

  it('acha pelo nome de um item e pelo código', () => {
    expect([...idsDeCaixasNaBusca(caixas, itens, 'martelo')]).toEqual(['c2']);
    expect([...idsDeCaixasNaBusca(caixas, itens, 'c-014')]).toEqual(['c2']);
  });

  it('devolve vazio quando nada bate', () => {
    expect(idsDeCaixasNaBusca(caixas, itens, 'serrote').size).toBe(0);
  });
});

describe('idsDeCaixasComTags', () => {
  const comTags: ItemStorage[] = [
    { id: 'i1', storage_id: 'c1', nome: 'Panela', quantidade: null, tag_id: 't1', ordem: 1 },
    { id: 'i2', storage_id: 'c1', nome: 'Colher', quantidade: null, tag_id: null, ordem: 2 },
    { id: 'i3', storage_id: 'c2', nome: 'Martelo', quantidade: null, tag_id: 't2', ordem: 1 },
  ];

  it('sem tags escolhidas devolve todas as caixas', () => {
    expect(idsDeCaixasComTags(caixas, comTags, []).size).toBe(3);
  });

  it('devolve as caixas que têm item com alguma das tags', () => {
    expect([...idsDeCaixasComTags(caixas, comTags, ['t1'])]).toEqual(['c1']);
    expect([...idsDeCaixasComTags(caixas, comTags, ['t1', 't2'])].sort()).toEqual(['c1', 'c2']);
    expect(idsDeCaixasComTags(caixas, comTags, ['t9']).size).toBe(0);
  });
});

describe('tag principal da caixa', () => {
  it('o item segue a tag da caixa quando não tem a própria', () => {
    expect(tagEfetivaDoItem({ tag_id: null }, { tag_id: 'a' })).toBe('a');
    expect(tagEfetivaDoItem({ tag_id: 'b' }, { tag_id: 'a' })).toBe('b');
    expect(tagEfetivaDoItem({ tag_id: null }, { tag_id: null })).toBeNull();
    expect(tagEfetivaDoItem({ tag_id: null }, undefined)).toBeNull();
  });

  it('a caixa fica com a principal e as tags diferentes dos itens, sem repetir', () => {
    const itensDaCaixa = [{ tag_id: 'a' }, { tag_id: 'b' }, { tag_id: 'b' }, { tag_id: null }, { tag_id: 'c' }];
    expect(tagsDaCaixa({ tag_id: 'a' }, itensDaCaixa)).toEqual({ principal: 'a', dosItens: ['b', 'c'] });
    expect(tagsDaCaixa({ tag_id: null }, [{ tag_id: null }])).toEqual({ principal: null, dosItens: [] });
  });

  it('o filtro acha a caixa pela principal ou pela tag própria de um item', () => {
    const cs: CaixaStorage[] = [
      { id: 'x', numero: 1, nome: 'X', ordem: 1, tag_id: 'a' },
      { id: 'y', numero: 2, nome: 'Y', ordem: 2, tag_id: null },
      { id: 'z', numero: 3, nome: 'Z', ordem: 3, tag_id: null },
    ];
    const is: ItemStorage[] = [{ id: 'i', storage_id: 'y', nome: 'Item', quantidade: null, tag_id: 'b', ordem: 1 }];
    expect([...idsDeCaixasComTags(cs, is, ['a'])]).toEqual(['x']);
    expect([...idsDeCaixasComTags(cs, is, ['b'])]).toEqual(['y']);
    expect([...idsDeCaixasComTags(cs, is, ['a', 'b'])].sort()).toEqual(['x', 'y']);
    expect(idsDeCaixasComTags(cs, is, []).size).toBe(3);
  });
});

describe('nomeDaCopia', () => {
  it('acrescenta (cópia) e numera as seguintes', () => {
    expect(nomeDaCopia('Cozinha', ['Cozinha'])).toBe('Cozinha (cópia)');
    expect(nomeDaCopia('Cozinha', ['Cozinha', 'Cozinha (cópia)'])).toBe('Cozinha (cópia 2)');
    expect(nomeDaCopia('Cozinha (cópia)', ['Cozinha', 'Cozinha (cópia)'])).toBe('Cozinha (cópia 2)');
  });
});
