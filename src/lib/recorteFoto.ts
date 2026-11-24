/**
 * Contas do recorte de foto em círculo: a imagem cobre o quadrado do recorte (zoom 1 = o menor lado
 * da imagem encosta nas bordas) e pode ser arrastada e ampliada, sem nunca deixar um vazio dentro do círculo.
 */

export const ZOOM_MINIMO = 1;
export const ZOOM_MAXIMO = 4;
/** Lado, em px, da foto final (quadrada; o círculo é só o formato de exibição). */
export const LADO_DA_FOTO = 512;

export interface PosicaoDaImagem {
  /** Canto superior esquerdo da imagem, em px do quadrado do recorte. */
  x: number;
  y: number;
  /** Tamanho da imagem desenhada, em px do quadrado do recorte. */
  largura: number;
  altura: number;
}

/** Tamanho da imagem desenhada para o zoom dado. */
export function tamanhoDaImagem(larguraOriginal: number, alturaOriginal: number, lado: number, zoom: number): { largura: number; altura: number } {
  const escala = (lado / Math.min(larguraOriginal, alturaOriginal)) * Math.min(Math.max(zoom, ZOOM_MINIMO), ZOOM_MAXIMO);
  return { largura: larguraOriginal * escala, altura: alturaOriginal * escala };
}

/** Segura a imagem dentro do quadrado: nenhuma borda dela pode entrar no recorte. */
export function limitarPosicao(x: number, y: number, largura: number, altura: number, lado: number): { x: number; y: number } {
  return { x: Math.min(0, Math.max(lado - largura, x)), y: Math.min(0, Math.max(lado - altura, y)) };
}

/** Posição inicial: imagem centralizada. */
export function posicaoCentralizada(larguraOriginal: number, alturaOriginal: number, lado: number, zoom: number): PosicaoDaImagem {
  const { largura, altura } = tamanhoDaImagem(larguraOriginal, alturaOriginal, lado, zoom);
  return { ...limitarPosicao((lado - largura) / 2, (lado - altura) / 2, largura, altura, lado), largura, altura };
}

/** Muda o zoom mantendo no centro do recorte o mesmo ponto da imagem. */
export function aplicarZoom(atual: PosicaoDaImagem, larguraOriginal: number, alturaOriginal: number, lado: number, zoom: number): PosicaoDaImagem {
  const { largura, altura } = tamanhoDaImagem(larguraOriginal, alturaOriginal, lado, zoom);
  const centroX = (lado / 2 - atual.x) / atual.largura;
  const centroY = (lado / 2 - atual.y) / atual.altura;
  return { ...limitarPosicao(lado / 2 - centroX * largura, lado / 2 - centroY * altura, largura, altura, lado), largura, altura };
}

/** Move a imagem (arrastar ou setas), sem sair do quadrado. */
export function moverImagem(atual: PosicaoDaImagem, dx: number, dy: number, lado: number): PosicaoDaImagem {
  return { ...atual, ...limitarPosicao(atual.x + dx, atual.y + dy, atual.largura, atual.altura, lado) };
}
