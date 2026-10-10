import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fontsDir = resolve(root, 'public/fonts');
mkdirSync(fontsDir, { recursive: true });

const fontMappings = [
  [
    'node_modules/@fontsource/lexend/files/lexend-latin-400-normal.woff2',
    'public/fonts/Lexend-Regular.woff2'
  ],
  [
    'node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2',
    'public/fonts/AtkinsonHyperlegible-Regular.woff2'
  ],
  [
    'node_modules/@fontsource/opendyslexic/files/opendyslexic-latin-400-normal.woff2',
    'public/fonts/OpenDyslexic-Regular.woff2'
  ]
];

for (const [src, dest] of fontMappings) {
  copyFileSync(resolve(root, src), resolve(root, dest));
}

function createIcon128Png() {
  const width = 128;
  const height = 128;
  const raw = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const idx = rowStart + 1 + x * 4;
      const dx = Math.min(x, width - 1 - x);
      const dy = Math.min(y, height - 1 - y);
      const isCornerOutside = dx < 20 && dy < 20 && (20 - dx) ** 2 + (20 - dy) ** 2 > 400;
      const isRulerBand = y >= 54 && y <= 72 && x >= 24 && x <= 104;
      const isTextLine =
        ((y >= 34 && y <= 42) || (y >= 84 && y <= 92)) && x >= 28 && x <= 96;

      if (isCornerOutside) {
        raw[idx] = 0;
        raw[idx + 1] = 0;
        raw[idx + 2] = 0;
        raw[idx + 3] = 0;
      } else if (isRulerBand) {
        raw[idx] = 251;
        raw[idx + 1] = 188;
        raw[idx + 2] = 4;
        raw[idx + 3] = 255;
      } else if (isTextLine) {
        raw[idx] = 255;
        raw[idx + 1] = 255;
        raw[idx + 2] = 255;
        raw[idx + 3] = 255;
      } else {
        raw[idx] = 26;
        raw[idx + 1] = 115;
        raw[idx + 2] = 232;
        raw[idx + 3] = 255;
      }
    }
  }

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function pngChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

writeFileSync(resolve(root, 'public/icon128.png'), createIcon128Png());
