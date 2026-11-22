import { describe, expect, it } from 'vitest';
import { layoutDaFolha, quebrarTexto } from './etiquetas';

describe('layoutDaFolha', () => {
  it('preenche as colunas da esquerda para a direita e cresce em linhas', () => {
    const folha = layoutDaFolha(5, 2, 600, 200, 40);
    expect(folha.largura).toBe(40 * 2 + 1200);
    expect(folha.altura).toBe(40 * 2 + 3 * 200);
    expect(folha.posicoes).toEqual([
      { x: 40, y: 40 },
      { x: 640, y: 40 },
      { x: 40, y: 240 },
      { x: 640, y: 240 },
      { x: 40, y: 440 },
    ]);
  });

  it('sem etiquetas ainda tem uma linha de altura', () => {
    const folha = layoutDaFolha(0, 2, 600, 200, 40);
    expect(folha.posicoes).toEqual([]);
    expect(folha.altura).toBe(80 + 200);
  });
});

// Largura de cada caractere = 1: "cabe" é só o tamanho do texto.
const cabeAte = (n: number) => (linha: string) => linha.length <= n;

describe('quebrarTexto', () => {
  it('texto curto fica numa linha só', () => {
    expect(quebrarTexto('Cozinha', cabeAte(10), 2)).toEqual(['Cozinha']);
  });

  it('quebra por palavras em até duas linhas, com reticências se sobrar texto', () => {
    expect(quebrarTexto('Panelas e frigideiras grandes', cabeAte(16), 2)).toEqual(['Panelas e', 'frigideiras…']);
    expect(quebrarTexto('Panelas e frigideiras', cabeAte(10), 2)).toEqual(['Panelas e', 'frigideiras'.slice(0, 9) + '…']);
  });

  it('põe reticências quando não cabe nas linhas permitidas', () => {
    const linhas = quebrarTexto('um dois tres quatro cinco seis sete oito', cabeAte(10), 2);
    expect(linhas).toHaveLength(2);
    expect(linhas[1].endsWith('…')).toBe(true);
    expect(linhas.every(cabeAte(10))).toBe(true);
  });

  it('uma palavra maior que a linha é cortada com reticências', () => {
    const linhas = quebrarTexto('supercalifragilistico', cabeAte(8), 2);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].length).toBeLessThanOrEqual(8);
    expect(linhas[0].endsWith('…')).toBe(true);
  });

  it('texto vazio não gera linhas', () => {
    expect(quebrarTexto('   ', cabeAte(8), 2)).toEqual([]);
  });
});
