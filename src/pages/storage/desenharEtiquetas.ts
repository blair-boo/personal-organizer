import { layoutDaFolha, quebrarTexto } from '../../lib/etiquetas';
import { MARGEM_RMQR, renderizarSimbolo, type SimboloRmqr } from '../../lib/rmqr';

export interface EtiquetaParaDesenhar {
  codigo: string;
  nome: string;
  simbolo: SimboloRmqr;
}

const FONTE = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const FOLHA_COLUNAS = 2;
const FOLHA_MARGEM = 40;
const FOLHA_LARGURA_CELULA = 620;
/** Largura reservada ao texto ao lado do código. */
const LARGURA_TEXTO = 300;
const ESPACO_ENTRE = 24;

function simboloEmCanvas(simbolo: SimboloRmqr, escala: number): HTMLCanvasElement {
  const imagem = renderizarSimbolo(simbolo, escala, MARGEM_RMQR);
  const canvas = document.createElement('canvas');
  canvas.width = imagem.width;
  canvas.height = imagem.height;
  canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(imagem.data), imagem.width, imagem.height), 0, 0);
  return canvas;
}

/** Desenha uma etiqueta (rMQR e, se pedido, código e nome ao lado) com o canto superior esquerdo em (x, y). */
function desenharCelula(ctx: CanvasRenderingContext2D, etiqueta: EtiquetaParaDesenhar, x: number, y: number, escala: number, incluirNome: boolean, larguraTexto: number) {
  const simbolo = simboloEmCanvas(etiqueta.simbolo, escala);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(simbolo, x, y);
  if (!incluirNome) return;
  const xTexto = x + simbolo.width + ESPACO_ENTRE;
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'middle';
  const tamanhoCodigo = Math.round(simbolo.height * 0.28);
  const tamanhoNome = Math.round(simbolo.height * 0.2);
  ctx.font = `700 ${tamanhoCodigo}px ${FONTE}`;
  ctx.fillText(etiqueta.codigo, xTexto, y + simbolo.height * 0.3, larguraTexto);
  ctx.font = `400 ${tamanhoNome}px ${FONTE}`;
  const linhas = quebrarTexto(etiqueta.nome, (l) => ctx.measureText(l).width <= larguraTexto, 2);
  linhas.forEach((linha, i) => ctx.fillText(linha, xTexto, y + simbolo.height * 0.58 + i * tamanhoNome * 1.2));
}

function fundoBranco(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível desenhar a etiqueta neste navegador.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return ctx;
}

/** Uma etiqueta numa imagem do tamanho dela. */
export function desenharEtiqueta(canvas: HTMLCanvasElement, etiqueta: EtiquetaParaDesenhar, escala: number, incluirNome: boolean) {
  const simbolo = simboloEmCanvas(etiqueta.simbolo, escala);
  const larguraTexto = LARGURA_TEXTO * (escala / 10);
  canvas.width = simbolo.width + (incluirNome ? ESPACO_ENTRE + larguraTexto : 0);
  canvas.height = simbolo.height;
  const ctx = fundoBranco(canvas);
  desenharCelula(ctx, etiqueta, 0, 0, escala, incluirNome, larguraTexto);
}

/** Várias etiquetas numa imagem só, em grade de duas colunas. */
export function desenharFolha(canvas: HTMLCanvasElement, etiquetas: EtiquetaParaDesenhar[], incluirNome: boolean) {
  const escala = 10;
  const alturaEtiqueta = (etiquetas[0]?.simbolo.altura ?? 11) + 2 * MARGEM_RMQR;
  const alturaCelula = alturaEtiqueta * escala + 30;
  const folha = layoutDaFolha(etiquetas.length, FOLHA_COLUNAS, FOLHA_LARGURA_CELULA, alturaCelula, FOLHA_MARGEM);
  canvas.width = folha.largura;
  canvas.height = folha.altura;
  const ctx = fundoBranco(canvas);
  etiquetas.forEach((etiqueta, i) => desenharCelula(ctx, etiqueta, folha.posicoes[i].x, folha.posicoes[i].y, escala, incluirNome, LARGURA_TEXTO));
}

export async function canvasParaPng(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Não foi possível gerar a imagem.');
  return blob;
}

export function baixarBlob(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}
