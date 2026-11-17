// Ropa mexicana generada con código. Lógica pura: no importa Phaser, DOM ni Polkadot.
//
// Igual que el sombrero de copa (wearables.ts): cada prenda es una matriz de índices de color con
// el tamaño de píxel de las ilustraciones y el contorno de cada mascota. Las franjas de sarape usan
// colores fijos (rosa mexicano, naranja, amarillo, verde, turquesa y morado); el color principal sale
// de la paleta que elige la persona.
import { colorOf, PX, type PixelArt, type WearablePalette } from './wearables.ts';

/** Índices extra para las franjas de sarape (colores fijos). */
export const STRIPES = [10, 11, 12, 13, 14, 15] as const;
export const STRIPE_COLORS: Readonly<Record<number, number>> = {
  10: 0xe4007c, 11: 0xff8c1a, 12: 0xffd23f, 13: 0x2e9e4f, 14: 0x00a6a6, 15: 0x7b2d8e,
};
/** Índice del color blanco de los puntitos del paliacate y de los flecos claros. */
export const WHITE = 16;

export type ClothKind = 'charro' | 'poncho' | 'paliacate' | 'rebozo';
export type ClothSize = 's' | 'm' | 'l';

/** Escala de cada talla respecto a la mediana. */
const SCALE: Readonly<Record<ClothSize, number>> = { s: 0.85, m: 1, l: 1.15 };

function grid(width: number, height: number) {
  const pixels = new Uint8Array(width * height);
  const set = (x: number, y: number, v: number) => { if (x >= 0 && y >= 0 && x < width && y < height) pixels[y * width + x] = v; };
  const get = (x: number, y: number) => (x >= 0 && y >= 0 && x < width && y < height ? pixels[y * width + x] : PX.empty);
  return { pixels, set, get };
}

/** Contorno de un píxel alrededor de todo lo dibujado (4 vecinos), como en las mascotas. */
function outline(pixels: Uint8Array, width: number, height: number) {
  const filled = pixels.slice();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (filled[y * width + x] !== PX.empty) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && filled[ny * width + nx] !== PX.empty && filled[ny * width + nx] !== PX.outline) {
        pixels[y * width + x] = PX.outline;
        break;
      }
    }
  }
}

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;

/** Sombrero charro: ala muy ancha y curva con bordado, copa redonda con toquilla. Se apoya en la cabeza. */
export function buildCharro(size: ClothSize): PixelArt {
  const k = SCALE[size];
  const brimW = Math.round(46 * k);
  const brimH = Math.round(11 * k);
  const crownW = Math.round(18 * k);
  const crownH = Math.round(13 * k);
  const width = brimW + 2;
  const height = crownH + brimH + 4;
  const { pixels, set } = grid(width, height);
  const cx = width / 2;
  const brimCy = height - brimH / 2 - 1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    // Ala: elipse; la orilla de arriba se levanta (forma de charro) y lleva bordado.
    if (inEllipse(x, y, cx, brimCy, brimW / 2, brimH / 2)) {
      const t = (x + 0.5 - (cx - brimW / 2)) / brimW;
      const edge = !inEllipse(x, y, cx, brimCy, brimW / 2 - 1.5, brimH / 2 - 1.2);
      const lower = !inEllipse(x, y - 1, cx, brimCy - 1, brimW / 2, brimH / 2);
      set(x, y, lower ? PX.dark : edge ? ((x % 3 === 0) ? PX.bandLight : PX.band) : t < 0.25 ? PX.light : t > 0.8 ? PX.dark : PX.base);
    }
    // Copa redonda (media elipse) con toquilla en zigzag.
    const crownCy = brimCy - 1;
    if (y + 0.5 < crownCy && inEllipse(x, y, cx, crownCy, crownW / 2, crownH)) {
      const t = (x + 0.5 - (cx - crownW / 2)) / crownW;
      const fromBase = crownCy - (y + 0.5);
      if (fromBase < 3) set(x, y, (x + y) % 2 === 0 ? PX.band : PX.bandLight);
      else set(x, y, t < 0.3 ? PX.light : t < 0.4 ? PX.shine : t > 0.78 ? PX.dark : PX.base);
    }
  }
  outline(pixels, width, height);
  return { width, height, pixels, pivot: { x: cx, y: brimCy + 0.5 } };
}

/**
 * Poncho de sarape: se cuelga del cuello (agujero arriba al centro), con franjas de colores, la
 * orilla en el color elegido y flecos abajo. El punto de apoyo es el cuello.
 */
export function buildPoncho(size: ClothSize): PixelArt {
  const k = SCALE[size];
  const topW = Math.round(18 * k);
  const bottomW = Math.round(42 * k);
  const bodyH = Math.round(26 * k);
  const fringe = 3;
  const width = bottomW + 4;
  const height = bodyH + fringe + 2;
  const { pixels, set } = grid(width, height);
  const cx = width / 2;
  for (let y = 0; y < bodyH; y++) {
    const half = (topW + (bottomW - topW) * (y / (bodyH - 1))) / 2;
    for (let x = Math.ceil(cx - half); x < Math.floor(cx + half); x++) {
      const yy = y + 1;
      // Agujero del cuello arriba al centro.
      if (y < 2 && Math.abs(x + 0.5 - cx) < topW * 0.22) continue;
      const border = x <= Math.ceil(cx - half) || x >= Math.floor(cx + half) - 1;
      const stripeRow = Math.floor((y - 2) / 2);
      const band = y >= 3 && y < bodyH - 2 && (y - 3) % 4 < 2;
      const t = (x - (cx - half)) / (2 * half);
      if (border || y < 2) set(x, yy, t < 0.5 ? PX.light : PX.base);
      else if (band) set(x, yy, STRIPES[(stripeRow + (x % 2 === 0 ? 0 : 0)) % STRIPES.length]);
      else set(x, yy, t < 0.2 ? PX.light : t > 0.82 ? PX.dark : PX.base);
    }
  }
  // Flecos: hilos alternados bajo la orilla.
  const halfBottom = bottomW / 2;
  for (let x = Math.ceil(cx - halfBottom) + 1; x < Math.floor(cx + halfBottom) - 1; x += 2) {
    for (let f = 0; f < fringe; f++) set(x, bodyH + 1 + f, f === fringe - 1 ? WHITE : PX.bandLight);
  }
  outline(pixels, width, height);
  return { width, height, pixels, pivot: { x: cx, y: 1.5 } };
}

/** Paliacate: pañuelo triangular anudado al cuello, con puntitos blancos. Se apoya en el cuello. */
export function buildPaliacate(size: ClothSize): PixelArt {
  const k = SCALE[size];
  const w = Math.round(26 * k);
  const h = Math.round(14 * k);
  const width = w + 4;
  const height = h + 4;
  const { pixels, set } = grid(width, height);
  const cx = width / 2;
  for (let y = 0; y < h; y++) {
    const half = (w / 2) * (1 - y / h);
    for (let x = Math.ceil(cx - half); x < Math.floor(cx + half); x++) {
      const t = (x - (cx - half)) / Math.max(1, 2 * half);
      const dot = (x + y * 2) % 4 === 0 && y % 2 === 1;
      set(x, y + 1, y === 0 ? PX.band : dot ? WHITE : t > 0.8 ? PX.dark : t < 0.2 ? PX.light : PX.base);
    }
  }
  // Nudo arriba al centro.
  set(Math.floor(cx) - 1, 0, PX.bandDark); set(Math.floor(cx), 0, PX.bandDark);
  outline(pixels, width, height);
  return { width, height, pixels, pivot: { x: cx, y: 1.5 } };
}

/** Rebozo: chal sobre los hombros, una banda curva con franjas finas y puntas con flecos. */
export function buildRebozo(size: ClothSize): PixelArt {
  const k = SCALE[size];
  const w = Math.round(44 * k);
  const bandH = Math.round(8 * k);
  const drop = Math.round(12 * k);
  const width = w + 4;
  const height = bandH + drop + 6;
  const { pixels, set } = grid(width, height);
  const cx = width / 2;
  for (let x = 2; x < width - 2; x++) {
    const u = (x + 0.5 - cx) / (w / 2);
    const top = 1 + Math.round(drop * u * u); // se cae hacia los lados
    for (let y = 0; y < bandH; y++) {
      const fine = y % 2 === 1 ? STRIPES[(Math.floor(x / 3) + y) % STRIPES.length] : (u < -0.4 ? PX.light : u > 0.5 ? PX.dark : PX.base);
      set(x, top + y, fine);
    }
    // Puntas con flecos en los extremos.
    if (Math.abs(u) > 0.8 && x % 2 === 0) for (let f = 0; f < 4; f++) set(x, top + bandH + f, f === 3 ? WHITE : PX.bandLight);
  }
  outline(pixels, width, height);
  return { width, height, pixels, pivot: { x: cx, y: 2 } };
}

export function buildCloth(kind: ClothKind, size: ClothSize): PixelArt {
  switch (kind) {
    case 'charro': return buildCharro(size);
    case 'poncho': return buildPoncho(size);
    case 'paliacate': return buildPaliacate(size);
    default: return buildRebozo(size);
  }
}

/** Dónde se pone cada prenda: en la cabeza o colgada del cuello. */
export const CLOTH_SLOT: Readonly<Record<ClothKind, 'head' | 'neck'>> = { charro: 'head', poncho: 'neck', paliacate: 'neck', rebozo: 'neck' };

/** Color de un índice de la ropa: franjas y blanco fijos; lo demás, la paleta y el contorno. */
export function clothColor(index: number, palette: WearablePalette, outline: number): number | null {
  if (index === WHITE) return 0xfff7e6;
  if (STRIPE_COLORS[index] !== undefined) return STRIPE_COLORS[index];
  return colorOf(index, palette, outline);
}
