import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'apps', 'extension', 'public', 'icons');

const COLORS = {
  green: [0x16, 0xa3, 0x4a, 0xff],
  amber: [0xf5, 0x9e, 0x0b, 0xff],
  red: [0xdc, 0x26, 0x26, 0xff],
  grey: [0x9c, 0xa3, 0xaf, 0xff],
};

const SIZES = [16, 32, 48, 128];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawIcon(size, color) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const radius = size / 2 - Math.max(1, size * 0.06);
  const inner = radius * 0.45;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const i = (y * size + x) * 4;

      if (dist > radius + 0.5) continue;

      const edgeAlpha = Math.max(0, Math.min(1, radius + 0.5 - dist));
      const alpha = Math.round(edgeAlpha * 255);

      const isDot = dist <= inner;
      if (isDot) {
        buf[i] = 0xff;
        buf[i + 1] = 0xff;
        buf[i + 2] = 0xff;
      } else {
        buf[i] = color[0];
        buf[i + 1] = color[1];
        buf[i + 2] = color[2];
      }
      buf[i + 3] = alpha;
    }
  }
  return buf;
}

mkdirSync(outDir, { recursive: true });

const written = [];
for (const [name, color] of Object.entries(COLORS)) {
  for (const size of SIZES) {
    const png = encodePng(size, size, drawIcon(size, color));
    const file = join(outDir, `${name}-${size}.png`);
    writeFileSync(file, png);
    written.push(`${name}-${size}.png (${png.length}B)`);
  }
}

console.log(`[icons] wrote ${written.length} files to ${outDir}`);
console.log(written.join('\n'));
