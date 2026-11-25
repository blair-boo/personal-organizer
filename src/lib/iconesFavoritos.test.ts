import { describe, expect, it } from 'vitest';
import { chaveIcone, conjuntoDeFavoritos, favoritosExistentes } from './iconesFavoritos';
import type { PastaIcones } from '../types';

const icone = (nome: string) => ({ id: nome, nome, url: `https://x/${nome}`, ordem: 0 });

describe('chaveIcone', () => {
  it('junta pasta e arquivo, e deixa só o arquivo na raiz', () => {
    expect(chaveIcone('PNG', 'a.png')).toBe('PNG/a.png');
    expect(chaveIcone('', 'a.svg')).toBe('a.svg');
  });
});

describe('favoritosExistentes', () => {
  const pastas: PastaIcones[] = [
    { pasta: '', icones: [icone('raiz.svg'), icone('outro.svg')] },
    { pasta: 'PNG', icones: [icone('a.png'), icone('b.png')] },
    { pasta: 'Simples', icones: [icone('a.png')] },
  ];

  it('junta os favoritos de todas as pastas, na ordem das pastas', () => {
    const favoritos = conjuntoDeFavoritos([
      { pasta: 'Simples', arquivo: 'a.png' },
      { pasta: '', arquivo: 'raiz.svg' },
      { pasta: 'PNG', arquivo: 'b.png' },
    ]);
    expect(favoritosExistentes(pastas, favoritos).map((f) => `${f.pasta}|${f.icone.nome}`)).toEqual(['|raiz.svg', 'PNG|b.png', 'Simples|a.png']);
  });

  it('diferencia arquivos de mesmo nome em pastas diferentes', () => {
    const favoritos = conjuntoDeFavoritos([{ pasta: 'PNG', arquivo: 'a.png' }]);
    expect(favoritosExistentes(pastas, favoritos).map((f) => f.pasta)).toEqual(['PNG']);
  });

  it('ignora favorito de arquivo que não existe mais', () => {
    const favoritos = conjuntoDeFavoritos([{ pasta: 'PNG', arquivo: 'apagado.png' }]);
    expect(favoritosExistentes(pastas, favoritos)).toEqual([]);
  });
});
