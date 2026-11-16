// Vestuario por capas. Lógica pura: no importa Phaser, DOM ni Polkadot.
//
// Cada prenda se genera con código como pixel art: una matriz de índices de color que la escena
// convierte en textura. Así una sola receta sirve para las cinco especies y sus tres edades:
//  - la forma sale de parámetros (tamaño, alto, ala, cinta), así que hay muchas variaciones;
//  - los colores salen de una paleta, así que cada forma tiene muchas combinaciones;
//  - el contorno usa el color de contorno de cada ilustración, para que parezca del mismo dibujo;
//  - el tamaño de píxel es el de las ilustraciones (BLOCK), así que la prenda no se ve borrosa ni
//    con píxeles más gordos que la mascota. Las ilustraciones originales no se modifican.
import type { PetId, Stage } from './types.ts';

/** Píxeles de la imagen original por píxel de la prenda (las ilustraciones miden ~10 px por píxel). */
export const BLOCK = 10;

/** Índices de la matriz. 0 = transparente. */
export const PX = {
  empty: 0, outline: 1, dark: 2, base: 3, light: 4, shine: 5, top: 6,
  bandDark: 7, band: 8, bandLight: 9,
} as const;
type PxIndex = (typeof PX)[keyof typeof PX];

export interface PixelArt {
  width: number;
  height: number;
  /** width × height índices, por filas. */
  pixels: Uint8Array;
  /** Punto que se apoya en la cabeza (centro del ala), en píxeles de la matriz. */
  pivot: { x: number; y: number };
}

/** Colores de una prenda: cuerpo y cinta. El contorno lo pone la mascota. */
export interface WearablePalette {
  id: string;
  name: string;
  /** Rampa del cuerpo: oscuro, base, claro, brillo y cara superior. */
  body: readonly [number, number, number, number, number];
  /** Rampa de la cinta: oscuro, base, claro. */
  band: readonly [number, number, number];
}

/** Paletas con los colores de la habitación (papel picado, talavera, sarape). */
export const HAT_PALETTES: readonly WearablePalette[] = [
  { id: 'noche', name: 'Noche', body: [0x23203a, 0x3b3656, 0x56507a, 0x8a84b0, 0x4a4468], band: [0x9c1a2c, 0xd7263d, 0xff6b7a] },
  { id: 'rosa', name: 'Rosa mexicano', body: [0x8a0049, 0xc8006c, 0xe4007c, 0xff8cc6, 0xd40074], band: [0xb86b00, 0xffd23f, 0xfff0a0] },
  { id: 'turquesa', name: 'Turquesa', body: [0x005a63, 0x00868a, 0x00a6a6, 0x7fe0d8, 0x009a9c], band: [0x14306b, 0x1f4fa3, 0x6f9be0] },
  { id: 'cempasuchil', name: 'Cempasúchil', body: [0xa04a00, 0xe07800, 0xff8c1a, 0xffd08a, 0xf08410], band: [0x5c1d6b, 0x7b2d8e, 0xb276c4] },
  { id: 'nopal', name: 'Nopal', body: [0x14532a, 0x23783d, 0x2e9e4f, 0x9be0a6, 0x2a8c46], band: [0x9c1a2c, 0xd7263d, 0xff6b7a] },
];

/** Forma del sombrero de copa, en píxeles de la prenda. */
export interface TopHatShape {
  /** Ancho del ala y su alto (elipse vista un poco desde arriba). */
  brimW: number;
  brimH: number;
  /** Ancho y alto de la copa. */
  crownW: number;
  crownH: number;
  /** Alto de la elipse de la tapa y de la base de la copa. */
  capH: number;
  /** Alto de la cinta. */
  bandH: number;
}

export const HAT_SIZES = {
  s: { brimW: 22, brimH: 6, crownW: 13, crownH: 11, capH: 4, bandH: 3 },
  m: { brimW: 26, brimH: 7, crownW: 15, crownH: 13, capH: 4, bandH: 3 },
  l: { brimW: 30, brimH: 8, crownW: 17, crownH: 15, capH: 5, bandH: 4 },
} as const satisfies Record<string, TopHatShape>;
export type HatSize = keyof typeof HAT_SIZES;

/** ¿(x, y) cae dentro de la elipse de centro (cx, cy) y radios (rx, ry)? Muestra en el centro del píxel. */
const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;

/** Sombreado cilíndrico por columna: luz a la izquierda, sombra a la derecha (como las mascotas). */
function cylinder(t: number): PxIndex {
  if (t < 0.12) return PX.base;
  if (t < 0.24) return PX.shine;
  if (t < 0.38) return PX.light;
  if (t < 0.8) return PX.base;
  return PX.dark;
}

/**
 * Sombrero de copa en pixel art. Se dibuja el ala, encima la copa (cilindro con tapa elíptica y
 * cinta que sigue la curva de la base) y al final el contorno de un píxel alrededor de todo.
 */
export function buildTopHat(shape: TopHatShape): PixelArt {
  const width = shape.brimW + 2;
  const height = shape.crownH + shape.capH + shape.brimH + 2;
  const cx = width / 2;
  const brimCy = 1 + shape.capH / 2 + shape.crownH + shape.brimH / 2 - 1;
  const capCy = 1 + shape.capH / 2;
  const crownL = cx - shape.crownW / 2;
  const crownR = cx + shape.crownW / 2;
  const baseCy = brimCy - 1; // la copa se apoya un poco detrás del centro del ala
  const pixels = new Uint8Array(width * height);
  const set = (x: number, y: number, v: PxIndex) => { pixels[y * width + x] = v; };

  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    // Ala: arriba la cara superior, la última franja es el borde en sombra.
    if (inEllipse(x, y, cx, brimCy, shape.brimW / 2, shape.brimH / 2)) {
      const t = (x + 0.5 - (cx - shape.brimW / 2)) / shape.brimW;
      const lower = !inEllipse(x, y - 1, cx, brimCy - 1, shape.brimW / 2, shape.brimH / 2);
      set(x, y, lower ? PX.dark : t < 0.2 ? PX.light : t > 0.85 ? PX.dark : PX.base);
    }
    // Copa: rectángulo entre la tapa y la base, más la media elipse de la base.
    const inSides = x + 0.5 >= crownL && x + 0.5 <= crownR;
    const inBody = inSides && y + 0.5 >= capCy && y + 0.5 <= baseCy;
    const inBase = inEllipse(x, y, cx, baseCy, shape.crownW / 2, shape.capH / 2) && y + 0.5 >= baseCy;
    const inCap = inEllipse(x, y, cx, capCy, shape.crownW / 2, shape.capH / 2);
    if (inBody || inBase || inCap) {
      const t = (x + 0.5 - crownL) / shape.crownW;
      // La cinta sigue la curva de la base: mide la distancia hacia abajo hasta salir de la copa.
      let below = 0;
      while (below <= shape.bandH) {
        const yy = y + below + 1;
        const still = (inSides && yy + 0.5 <= baseCy) || (inEllipse(x, yy, cx, baseCy, shape.crownW / 2, shape.capH / 2) && yy + 0.5 >= baseCy);
        if (!still) break;
        below++;
      }
      if (inCap && !inBody) set(x, y, t > 0.8 ? PX.base : PX.top);
      else if (below < shape.bandH) set(x, y, t < 0.3 ? PX.bandLight : t > 0.8 ? PX.bandDark : PX.band);
      else set(x, y, cylinder(t));
    }
  }
  // Borde de la tapa: separa la cara superior del cilindro, como un contorno interior.
  for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) {
    const v = pixels[y * width + x];
    if (v === PX.top && y + 1 < height && pixels[(y + 1) * width + x] !== PX.top && pixels[(y + 1) * width + x] !== PX.empty) {
      if (!inEllipse(x, y + 1, cx, capCy, shape.crownW / 2, shape.capH / 2)) set(x, y, PX.base);
    }
  }
  // Contorno de un píxel: todo píxel vacío que toca la prenda (incluidas diagonales, como en las mascotas).
  const filled = pixels.slice();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (filled[y * width + x] !== PX.empty) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && filled[ny * width + nx] !== PX.empty && filled[ny * width + nx] !== PX.outline) {
        set(x, y, PX.outline);
        break;
      }
    }
  }
  return { width, height, pixels, pivot: { x: cx, y: brimCy + 0.5 } };
}

/** Color RGB (0xRRGGBB) de cada índice con la paleta y el contorno de la mascota; null = transparente. */
export function colorOf(index: number, palette: WearablePalette, outline: number): number | null {
  switch (index) {
    case PX.outline: return outline;
    case PX.dark: return palette.body[0];
    case PX.base: return palette.body[1];
    case PX.light: return palette.body[2];
    case PX.shine: return palette.body[3];
    case PX.top: return palette.body[4];
    case PX.bandDark: return palette.band[0];
    case PX.band: return palette.band[1];
    case PX.bandLight: return palette.band[2];
    default: return null;
  }
}

/**
 * Dónde va el sombrero en cada ilustración: punto de la cabeza en píxeles de la imagen original
 * (las de 1254×1254; el ajolote bebé usa su cuadro de 356×276), inclinación en grados, tamaño y
 * color del contorno de esa ilustración. Medido sobre `public/assets/pets/<especie>/<etapa>.png`.
 */
export interface HeadAnchor {
  x: number; y: number; angle: number; size: HatSize; outline: number;
  /** Píxeles de la imagen por píxel de la prenda si no es BLOCK (el ajolote bebé tiene píxeles de ~4). */
  block?: number;
}

export const HEAD_ANCHORS: Record<PetId, Record<Stage, HeadAnchor>> = {
  0: {
    baby: { x: 156, y: 95, angle: 0, size: 's', outline: 0x500010, block: 4 },
    teen: { x: 439, y: 300, angle: -4, size: 'm', outline: 0x400018 },
    adult: { x: 470, y: 300, angle: -4, size: 'm', outline: 0x380010 },
  },
  1: {
    baby: { x: 800, y: 300, angle: 6, size: 's', outline: 0x081030 },
    teen: { x: 830, y: 230, angle: 6, size: 's', outline: 0x000828 },
    adult: { x: 930, y: 120, angle: 6, size: 's', outline: 0x000038 },
  },
  2: {
    baby: { x: 800, y: 300, angle: 4, size: 'm', outline: 0x000830 },
    teen: { x: 800, y: 215, angle: 4, size: 'm', outline: 0x000028 },
    adult: { x: 875, y: 110, angle: 4, size: 'm', outline: 0x000030 },
  },
  3: {
    baby: { x: 850, y: 420, angle: 8, size: 's', outline: 0x000028 },
    teen: { x: 860, y: 285, angle: 8, size: 's', outline: 0x000030 },
    adult: { x: 985, y: 285, angle: 8, size: 's', outline: 0x000030 },
  },
  4: {
    baby: { x: 990, y: 385, angle: 10, size: 's', outline: 0x000828 },
    teen: { x: 1050, y: 305, angle: 10, size: 'm', outline: 0x000028 },
    adult: { x: 1097, y: 315, angle: 10, size: 'm', outline: 0x000028 },
  },
};

/** Lo que la mascota lleva puesto en la cabeza: forma y paleta. */
export interface HeadWear { kind: 'top-hat'; palette: string }

/** Prendas de la tienda que se dibujan como pixel art (las demás siguen siendo emoji). */
export const WEARABLE_ITEMS: Readonly<Record<string, HeadWear>> = {
  'shop:sombrero': { kind: 'top-hat', palette: 'noche' },
  'demo:sombrero': { kind: 'top-hat', palette: 'noche' },
};

export const findPalette = (id: string) => HAT_PALETTES.find((p) => p.id === id) ?? HAT_PALETTES[0];

/** Clave de textura: una por forma, tamaño, paleta y contorno. */
export const wearKey = (wear: HeadWear, size: HatSize, outline: number) =>
  `wear-${wear.kind}-${size}-${wear.palette}-${outline.toString(16)}`;

/** Prendas que se pueden recolorear y la paleta que eligió la persona para cada una. */
export const isWearable = (itemId: string | null | undefined): itemId is string => !!itemId && itemId in WEARABLE_ITEMS;

/** Prenda puesta con la paleta elegida, o null si el accesorio no es de pixel art. */
export function headWearFor(itemId: string | null | undefined, palette: string): HeadWear | null {
  if (!isWearable(itemId)) return null;
  return { ...WEARABLE_ITEMS[itemId], palette: HAT_PALETTES.some((p) => p.id === palette) ? palette : WEARABLE_ITEMS[itemId].palette };
}

const PALETTE_KEY = 'tamagotchi-polkadot-hat-palette-v1';
let paletteMemory: string | null = null;

export function loadHatPalette(): string {
  let raw = paletteMemory;
  try { raw = localStorage.getItem(PALETTE_KEY); } catch { /* sin localStorage */ }
  return raw && HAT_PALETTES.some((p) => p.id === raw) ? raw : HAT_PALETTES[0].id;
}

export function saveHatPalette(id: string): void {
  paletteMemory = id;
  try { localStorage.setItem(PALETTE_KEY, id); } catch { /* se queda en memoria */ }
}
