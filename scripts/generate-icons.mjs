// Gera ícones PWA placeholder (quadrado sólido na cor de destaque do app) sem
// depender de nenhuma lib de imagem — só o zlib nativo do Node pra montar um
// PNG mínimo (assinatura + IHDR + IDAT + IEND). Substitua os arquivos gerados
// em public/icons/ quando tiver um ícone de verdade.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const COR_FUNDO = [15, 76, 58]; // #0f4c3a

function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(tipo, dados) {
  const tipoBuf = Buffer.from(tipo, 'ascii');
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([tipoBuf, dados])), 0);
  return Buffer.concat([tamanho, tipoBuf, dados, crcBuf]);
}

/** Gera um PNG RGBA quadrado sólido, com um "O" simples desenhado por cima em branco. */
function gerarPngQuadrado(tamanho, comMargemSegura = false) {
  const [r, g, b] = COR_FUNDO;
  // Margem de segurança pro ícone maskable (Android corta ~20% das bordas).
  const margem = comMargemSegura ? Math.round(tamanho * 0.14) : 0;
  const raioExterno = tamanho / 2 - margem * 0.6;
  const raioInterno = raioExterno * 0.55;
  const cx = tamanho / 2;
  const cy = tamanho / 2;

  const linhas = [];
  for (let y = 0; y < tamanho; y++) {
    const linha = Buffer.alloc(1 + tamanho * 4);
    linha[0] = 0; // sem filtro
    for (let x = 0; x < tamanho; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const noAnel = dist <= raioExterno && dist >= raioInterno;
      const i = 1 + x * 4;
      if (noAnel) {
        linha[i] = 255;
        linha[i + 1] = 255;
        linha[i + 2] = 255;
        linha[i + 3] = 255;
      } else {
        linha[i] = r;
        linha[i + 1] = g;
        linha[i + 2] = b;
        linha[i + 3] = 255;
      }
    }
    linhas.push(linha);
  }
  const raw = Buffer.concat(linhas);
  const idat = deflateSync(raw);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tamanho, 0);
  ihdr.writeUInt32BE(tamanho, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(path.join(PUBLIC_DIR, 'icons'), { recursive: true });

writeFileSync(path.join(PUBLIC_DIR, 'favicon-32.png'), gerarPngQuadrado(32));
writeFileSync(path.join(PUBLIC_DIR, 'icons', 'apple-touch-icon.png'), gerarPngQuadrado(180));
writeFileSync(path.join(PUBLIC_DIR, 'icons', 'icon-192.png'), gerarPngQuadrado(192));
writeFileSync(path.join(PUBLIC_DIR, 'icons', 'icon-512.png'), gerarPngQuadrado(512));
writeFileSync(path.join(PUBLIC_DIR, 'icons', 'maskable-icon-512.png'), gerarPngQuadrado(512, true));

console.log('Ícones placeholder gerados em public/ e public/icons/.');
