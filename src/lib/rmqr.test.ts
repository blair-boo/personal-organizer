import { describe, expect, it, vi } from 'vitest';

// O módulo importa os .wasm com ?url; aqui só se testa o desenho do símbolo.
vi.mock('zxing-wasm/reader', () => ({ prepareZXingModule: vi.fn(), readBarcodes: vi.fn() }));
vi.mock('zxing-wasm/writer', () => ({ prepareZXingModule: vi.fn(), writeBarcode: vi.fn() }));
vi.mock('zxing-wasm/reader/zxing_reader.wasm?url', () => ({ default: 'leitor.wasm' }));
vi.mock('zxing-wasm/writer/zxing_writer.wasm?url', () => ({ default: 'escritor.wasm' }));

import { renderizarSimbolo, type SimboloRmqr } from './rmqr';

// 3x2 módulos: linha de cima escura-clara-escura, linha de baixo clara-escura-clara.
const simbolo: SimboloRmqr = {
  largura: 3,
  altura: 2,
  modulos: new Uint8ClampedArray([0, 255, 0, 255, 0, 255]),
};

function pixel(img: { data: Uint8ClampedArray; width: number }, x: number, y: number) {
  return img.data[(y * img.width + x) * 4];
}

describe('renderizarSimbolo', () => {
  it('soma a margem nos quatro lados e multiplica pela escala', () => {
    const img = renderizarSimbolo(simbolo, 4, 2);
    expect(img.width).toBe((3 + 4) * 4);
    expect(img.height).toBe((2 + 4) * 4);
    expect(img.data.length).toBe(img.width * img.height * 4);
  });

  it('pinta de preto só os módulos escuros e deixa a margem branca', () => {
    const img = renderizarSimbolo(simbolo, 2, 1);
    // margem de 1 módulo = 2 px: o primeiro módulo escuro começa em (2, 2)
    expect(pixel(img, 0, 0)).toBe(255);
    expect(pixel(img, 2, 2)).toBe(0);
    expect(pixel(img, 3, 3)).toBe(0);
    // módulo claro (coluna 1, linha 0) continua branco
    expect(pixel(img, 4, 2)).toBe(255);
    // módulo escuro da segunda linha (coluna 1)
    expect(pixel(img, 4, 4)).toBe(0);
  });

  it('usa canal alfa opaco em tudo', () => {
    const img = renderizarSimbolo(simbolo, 1, 2);
    for (let i = 3; i < img.data.length; i += 4) expect(img.data[i]).toBe(255);
  });
});
