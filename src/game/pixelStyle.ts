// Estilo "Pixel real". Lógica pura: no importa Phaser, DOM ni Polkadot.
//
// Las ilustraciones generadas parecen pixel art pero no lo son: sus "píxeles" miden 9, 10 o 12 px,
// tienen degradados y bordes suaves. Este filtro las lleva a una cuadrícula exacta (cada bloque de
// `block`×`block` toma su color dominante, no el promedio, para no emborronar), reduce la imagen a
// una paleta corta y unifica el contorno con la tinta del juego. El tamaño no cambia: el sombrero,
// los ojos dormidos y las variantes de color siguen alineados.

export interface PixelStyleOptions {
  /** Píxeles de la imagen por píxel lógico (10 en las ilustraciones de 1254 px; 4 en el bebé ajolote). */
  block: number;
  /** Colores máximos de la imagen. */
  colors: number;
  /** Tinta del contorno (los colores muy oscuros se igualan a ella). */
  ink: number;
}

export const PIXEL_STYLE: PixelStyleOptions = { block: 10, colors: 28, ink: 0x2b1d33 };

type RGB = [number, number, number];

/** Color dominante del bloque (cubetas de 16 niveles por canal); null si es mayormente transparente. */
function blockColor(data: Uint8ClampedArray, width: number, x0: number, y0: number, bw: number, bh: number): RGB | null {
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
  let opaque = 0;
  for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) {
    const i = (y * width + x) * 4;
    if (data[i + 3] < 128) continue;
    opaque++;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const c = counts.get(key);
    if (c) { c.n++; c.r += data[i]; c.g += data[i + 1]; c.b += data[i + 2]; } else counts.set(key, { n: 1, r: data[i], g: data[i + 1], b: data[i + 2] });
  }
  if (opaque * 2 < bw * bh) return null;
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const c of counts.values()) if (!best || c.n > best.n) best = c;
  return best ? [best.r / best.n, best.g / best.n, best.b / best.n] : null;
}

/** Colores de acento que se agregan a la paleta y qué tan distinto debe ser uno para entrar. */
const ACCENTS = 20;
const ACCENT_DISTANCE = 9 * 32 * 32;

const dist2 = (a: RGB, b: RGB) => 2 * (a[0] - b[0]) ** 2 + 4 * (a[1] - b[1]) ** 2 + 3 * (a[2] - b[2]) ** 2;

/** Paleta corta por k-medias (inicio determinista por popularidad), para que el resultado sea estable. */
export function buildPalette(samples: readonly RGB[], k: number, iterations = 8): RGB[] {
  if (samples.length === 0) return [];
  const sorted = [...samples].sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  const centers: RGB[] = [];
  for (let i = 0; i < k; i++) centers.push([...sorted[Math.floor(((i + 0.5) / k) * sorted.length)]] as RGB);
  for (let it = 0; it < iterations; it++) {
    const acc = centers.map(() => [0, 0, 0, 0]);
    for (const s of samples) {
      let bi = 0;
      let bd = Infinity;
      for (let c = 0; c < centers.length; c++) { const d = dist2(s, centers[c]); if (d < bd) { bd = d; bi = c; } }
      acc[bi][0] += s[0]; acc[bi][1] += s[1]; acc[bi][2] += s[2]; acc[bi][3]++;
    }
    for (let c = 0; c < centers.length; c++) if (acc[c][3]) centers[c] = [acc[c][0] / acc[c][3], acc[c][1] / acc[c][3], acc[c][2] / acc[c][3]];
  }
  return centers;
}

/** Devuelve una copia de la imagen en pixel art real. `data` no se modifica. */
export function toRealPixelArt(data: Uint8ClampedArray, width: number, height: number, options: PixelStyleOptions = PIXEL_STYLE): Uint8ClampedArray {
  const { block, colors, ink } = options;
  const cols = Math.ceil(width / block);
  const rows = Math.ceil(height / block);
  const cells: Array<RGB | null> = new Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x0 = c * block;
    const y0 = r * block;
    cells[r * cols + c] = blockColor(data, width, x0, y0, Math.min(block, width - x0), Math.min(block, height - y0));
  }
  const filled = cells.filter((c): c is RGB => c !== null);
  const palette = buildPalette(filled, Math.min(colors, Math.max(1, filled.length)));
  // Acentos: colores poco frecuentes pero muy distintos (lengua, brillo de los ojos, nariz rosa) se
  // quedan con su propio lugar en la paleta, para no perder los detalles que dan expresión.
  for (const cell of filled) {
    if (palette.length >= colors + ACCENTS) break;
    let bd = Infinity;
    for (const p of palette) bd = Math.min(bd, dist2(cell, p));
    if (bd > ACCENT_DISTANCE) palette.push(cell);
  }
  const inkRGB: RGB = [(ink >> 16) & 255, (ink >> 8) & 255, ink & 255];
  const out = new Uint8ClampedArray(width * height * 4);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cell = cells[r * cols + c];
    if (!cell) continue;
    let color: RGB = palette[0];
    let bd = Infinity;
    for (const p of palette) { const d = dist2(cell, p); if (d < bd) { bd = d; color = p; } }
    // Los casi negros se igualan a la tinta: un solo contorno en toda la ilustración.
    if (color[0] + color[1] + color[2] < 150) color = inkRGB;
    for (let y = r * block; y < Math.min(height, (r + 1) * block); y++) for (let x = c * block; x < Math.min(width, (c + 1) * block); x++) {
      const i = (y * width + x) * 4;
      out[i] = color[0]; out[i + 1] = color[1]; out[i + 2] = color[2]; out[i + 3] = 255;
    }
  }
  return out;
}
