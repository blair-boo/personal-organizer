/**
 * Leitura e geração de rMQR (QR retangular, bom para etiqueta estreita) com
 * zxing-wasm. O arquivo .wasm vem junto do app (não do CDN padrão da
 * biblioteca) e entra no precache do service worker, então funciona sem internet.
 * Este módulo é carregado sob demanda (import dinâmico) pelas telas que usam.
 */
import { prepareZXingModule as prepararLeitor, readBarcodes } from 'zxing-wasm/reader';
import { prepareZXingModule as prepararEscritor, writeBarcode } from 'zxing-wasm/writer';
import leitorWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import escritorWasmUrl from 'zxing-wasm/writer/zxing_writer.wasm?url';

/** Margem em módulos exigida pelo rMQR (o QR comum pede 4). */
export const MARGEM_RMQR = 2;

let preparado = false;
function prepararModulos() {
  if (preparado) return;
  preparado = true;
  const apontarParaLocal = (url: string) => ({
    locateFile: (caminho: string, prefixo: string) => (caminho.endsWith('.wasm') ? url : prefixo + caminho),
  });
  prepararLeitor({ overrides: apontarParaLocal(leitorWasmUrl) });
  prepararEscritor({ overrides: apontarParaLocal(escritorWasmUrl) });
}

/** Módulos do símbolo, sem margem: 1 byte por módulo, 0 = escuro. */
export interface SimboloRmqr {
  largura: number;
  altura: number;
  modulos: Uint8ClampedArray;
}

export interface ImagemRgba {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Desenha o símbolo em RGBA (preto sobre branco) com a margem pedida; `escala` = pixels por módulo. */
export function renderizarSimbolo(simbolo: SimboloRmqr, escala: number, margem = MARGEM_RMQR): ImagemRgba {
  const largura = (simbolo.largura + 2 * margem) * escala;
  const altura = (simbolo.altura + 2 * margem) * escala;
  const data = new Uint8ClampedArray(largura * altura * 4).fill(255);
  for (let y = 0; y < simbolo.altura; y++) {
    for (let x = 0; x < simbolo.largura; x++) {
      if (simbolo.modulos[y * simbolo.largura + x] !== 0) continue;
      for (let dy = 0; dy < escala; dy++) {
        for (let dx = 0; dx < escala; dx++) {
          const i = (((y + margem) * escala + dy) * largura + (x + margem) * escala + dx) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return { data, width: largura, height: altura };
}

/** Gera o rMQR de um texto curto (o código da caixa). */
export async function gerarSimboloRmqr(texto: string): Promise<SimboloRmqr> {
  prepararModulos();
  const r = await writeBarcode(texto, { format: 'RMQRCode', ecLevel: 'M' });
  if (r.error || !r.symbol) throw new Error(r.error || 'Não foi possível gerar o código.');
  return { largura: r.symbol.width, altura: r.symbol.height, modulos: r.symbol.data };
}

/** Lê rMQR (e QR comum) numa imagem ou quadro da câmera. Devolve os textos encontrados. */
export async function lerCodigos(imagem: ImageData | Blob): Promise<string[]> {
  prepararModulos();
  const achados = await readBarcodes(imagem, { formats: ['RMQRCode', 'QRCode'], tryHarder: true, maxNumberOfSymbols: 1 });
  return achados.filter((a) => a.isValid).map((a) => a.text);
}
