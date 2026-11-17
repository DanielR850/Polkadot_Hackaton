// Hoja de vista previa ampliada de todo el pixel art (solo para revisar; no se usa en el juego).
//   node tools/pixel-art/preview.mjs [salida.png]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { Art } from './art.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'assets');
const DIRS = ['items/accessories', 'items/walls', 'items/floors', 'items/furniture', 'items/decor', 'ui/icons'];
const SCALE = 4, CELL = 36 * SCALE / 4 * 4 / SCALE; // celda de 36 px de arte

/** Lee un PNG RGBA de 8 bits sin entrelazar (incluye los filtros estándar). */
function decode(buf) {
  let pos = 8, w = 0, h = 0; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); }
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = w * 4, out = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= 4 ? out[y * stride + x - 4] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= 4 && y ? out[(y - 1) * stride + x - 4] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      out[y * stride + x] = (v + pred) & 255;
    }
  }
  return { w, h, px: out };
}

const rows = DIRS.map((d) => readdirSync(join(ROOT, d)).filter((f) => f.endsWith('.png')).map((f) => decode(readFileSync(join(ROOT, d, f)))));
const cols = Math.max(...rows.map((r) => r.length));
const sheet = new Art(cols * CELL * SCALE, rows.length * CELL * SCALE).fill('#c9d3de');
rows.forEach((items, r) => items.forEach((img, i) => {
  const ox = i * CELL * SCALE + ((CELL - img.w) * SCALE) / 2, oy = r * CELL * SCALE + ((CELL - img.h) * SCALE) / 2;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const k = (y * img.w + x) * 4;
    if (img.px[k + 3] < 128) continue;
    const hex = `#${[0, 1, 2].map((j) => img.px[k + j].toString(16).padStart(2, '0')).join('')}`;
    sheet.rect(ox + x * SCALE, oy + y * SCALE, SCALE, SCALE, hex);
  }
}));
const outFile = process.argv[2] ?? join(process.env.TEMP ?? '.', 'pixel-art-preview.png');
writeFileSync(outFile, sheet.png());
console.log(outFile);
