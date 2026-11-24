import { describe, expect, it } from 'vitest';
import { aplicarZoom, limitarPosicao, moverImagem, posicaoCentralizada, tamanhoDaImagem } from './recorteFoto';

describe('recorte de foto', () => {
  it('zoom 1 faz o menor lado da imagem encostar nas bordas do recorte', () => {
    expect(tamanhoDaImagem(400, 200, 100, 1)).toEqual({ largura: 200, altura: 100 });
    expect(tamanhoDaImagem(200, 400, 100, 2)).toEqual({ largura: 200, altura: 400 });
  });

  it('o zoom fica entre o mínimo e o máximo', () => {
    expect(tamanhoDaImagem(100, 100, 100, 0.2).largura).toBe(100);
    expect(tamanhoDaImagem(100, 100, 100, 99).largura).toBe(400);
  });

  it('centraliza a imagem', () => {
    expect(posicaoCentralizada(400, 200, 100, 1)).toEqual({ x: -50, y: 0, largura: 200, altura: 100 });
  });

  it('nunca deixa uma borda da imagem entrar no recorte', () => {
    expect(limitarPosicao(10, 10, 200, 100, 100)).toEqual({ x: 0, y: 0 });
    expect(limitarPosicao(-500, -500, 200, 100, 100)).toEqual({ x: -100, y: 0 });
    const movida = moverImagem(posicaoCentralizada(400, 200, 100, 1), 999, 999, 100);
    expect(movida).toMatchObject({ x: 0, y: 0 });
  });

  it('ao ampliar mantém o mesmo ponto no centro', () => {
    const inicial = posicaoCentralizada(200, 200, 100, 1);
    const ampliada = aplicarZoom(inicial, 200, 200, 100, 2);
    expect(ampliada).toEqual({ x: -50, y: -50, largura: 200, altura: 200 });
  });
});
