import { describe, expect, it } from 'vitest';
import type { UsoIcone } from '../types';
import { arquivosEmUso, contarUsos, corCssDoUso, resolverUso, tamanhoDoUso, usosDoIcone } from './iconesUsos';
import { ICONE_PLACEHOLDER } from './iconesFuncoes';

function uso(parcial: Partial<UsoIcone>): UsoIcone {
  return {
    alvo_tipo: 'categoria',
    alvo_id: 'a',
    icone_pasta: 'PNG',
    icone_arquivo: 'casa.png',
    tamanho_delta: 0,
    mascara: false,
    cor_origem: 'padrao',
    cor_valor: null,
    tema: 'ambos',
    ...parcial,
  };
}

describe('resolverUso', () => {
  it('prefere o uso do tema atual e cai para ambos', () => {
    const usos = [uso({ tema: 'ambos', icone_arquivo: 'x.png' }), uso({ tema: 'escuro', icone_arquivo: 'y.png' })];
    expect(resolverUso(usos, 'categoria', 'a', 'escuro')?.icone_arquivo).toBe('y.png');
    expect(resolverUso(usos, 'categoria', 'a', 'claro')?.icone_arquivo).toBe('x.png');
  });

  it('devolve null sem uso para o alvo', () => {
    expect(resolverUso([uso({})], 'categoria', 'b', 'claro')).toBeNull();
    expect(resolverUso([uso({})], 'aba', 'a', 'claro')).toBeNull();
  });
});

describe('tamanhoDoUso', () => {
  it('soma a diferença e respeita o mínimo', () => {
    expect(tamanhoDoUso({ tamanho_delta: 4 }, 18)).toBe(22);
    expect(tamanhoDoUso({ tamanho_delta: -20 }, 18)).toBe(8);
  });
});

describe('corCssDoUso', () => {
  it('só tem cor com máscara e origem diferente de padrão', () => {
    expect(corCssDoUso({ mascara: true, cor_origem: 'padrao', cor_valor: null })).toBeUndefined();
    expect(corCssDoUso({ mascara: false, cor_origem: 'minha', cor_valor: '#fff' })).toBeUndefined();
    expect(corCssDoUso({ mascara: true, cor_origem: 'app', cor_valor: '--accent' })).toBe('var(--accent)');
    expect(corCssDoUso({ mascara: true, cor_origem: 'minha', cor_valor: '#112233' })).toBe('#112233');
  });
});

describe('arquivosEmUso e usos', () => {
  it('inclui padrões de função, placeholder e usos salvos', () => {
    const em = arquivosEmUso([uso({ icone_arquivo: 'gato.png' })]);
    expect(em.has('save.svg')).toBe(true);
    expect(em.has(ICONE_PLACEHOLDER)).toBe(true);
    expect(em.has('PNG/gato.png')).toBe(true);
    expect(em.has('PNG/cama.png')).toBe(false);
  });

  it('usosDoIcone ignora funções e conta instâncias', () => {
    const usos = [uso({ alvo_id: 'a' }), uso({ alvo_id: 'b' }), uso({ alvo_tipo: 'funcao', alvo_id: 'salvar', icone_pasta: '', icone_arquivo: 'casa.png' })];
    expect(usosDoIcone(usos, 'PNG/casa.png')).toHaveLength(2);
    expect(contarUsos(usos, 'PNG/casa.png')).toBe(2);
    expect(contarUsos([], 'save.svg')).toBe(1);
  });
});
