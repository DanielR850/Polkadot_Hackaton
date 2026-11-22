// Variantes de color de las mascotas. Lógica pura: no importa Phaser, DOM ni Polkadot.
//
// Técnica: mapa de degradado. Cada ilustración original tiene una rampa de colores (del contorno
// oscuro al brillo). A cada píxel de esa rampa se le asigna el color equivalente de una rampa nueva
// según su luminosidad, así que conserva su luz, su sombra y su detalle: no se redibuja nada ni se
// pierde calidad. Los píxeles fuera de la rampa (ojos, lengua, nariz rosa…) no se tocan.
import type { PetId } from './types.ts';

export interface ColorVariant {
  id: string;
  name: string;
  /** Colores destino, uno por cada punto de la rampa original de la especie (mismo orden). */
  ramp: readonly number[];
}

/** Regla para elegir qué píxeles pertenecen a la rampa: cumple todas sus condiciones. */
export interface PixelRule {
  /** Tono (grados); el rango puede cruzar 0° (p. ej. 300 → 25). */
  hueFrom?: number;
  hueTo?: number;
  minS?: number;
  maxS?: number;
  minL?: number;
}

/** Rampa original de una especie y qué píxeles pertenecen a ella. */
export interface SpeciesRamp {
  /** Luminosidad (0–1) de cada punto de la rampa original, de oscuro a claro. */
  stops: readonly number[];
  /** Un píxel pertenece a la rampa si cumple alguna regla. */
  rules: readonly PixelRule[];
  /** Protege la boca y la lengua: zonas oscuras o rojas encerradas en la cara bajo los ojos. */
  protectMouth?: boolean;
  variants: readonly ColorVariant[];
}

/**
 * Rampas medidas sobre `public/assets/pets/<especie>/*.png`. Las variantes siguen animales reales:
 * morfos de ajolote, lobo ártico y rojo, oso polar y negro, tlacuache albino, manatí con algas…
 */
export const SPECIES_RAMPS: Partial<Record<PetId, SpeciesRamp>> = {
  // Ajolote: contorno granate → rojo profundo → branquias → rosa medio → cuerpo → brillo.
  0: {
    stops: [0.14, 0.44, 0.59, 0.75, 0.85, 0.95],
    rules: [{ hueFrom: 300, hueTo: 25, minS: 0.25 }],
    protectMouth: true,
    variants: [
      { id: 'dorado', name: 'Dorado', ramp: [0x5a2600, 0xc26400, 0xff9838, 0xffc46a, 0xffe08e, 0xfff4c8] },
      { id: 'silvestre', name: 'Silvestre', ramp: [0x1a2112, 0x3c4626, 0x7a5a8c, 0x66713f, 0x87905a, 0xb6bd86] },
      { id: 'melanico', name: 'Melánico', ramp: [0x0a0912, 0x26213a, 0x5b3f8c, 0x373450, 0x48455f, 0x77739c] },
      { id: 'cobre', name: 'Cobre', ramp: [0x3a1206, 0x8a3616, 0xd8603a, 0xd49270, 0xebb592, 0xf8dcc4] },
    ],
  },
  // Lobo: pelaje gris y crema poco saturado (más el contorno azul marino).
  1: {
    stops: [0.06, 0.2, 0.37, 0.5, 0.7, 0.92],
    rules: [{ maxS: 0.3 }, { hueFrom: 200, hueTo: 260 }],
    variants: [
      { id: 'artico', name: 'Ártico', ramp: [0x0d1a3a, 0x8a93a8, 0xc9ced8, 0xdde1e8, 0xf2efe9, 0xffffff] },
      { id: 'negro', name: 'Negro', ramp: [0x05060f, 0x1c1b24, 0x2e2c38, 0x3b3946, 0x6e6a78, 0xb8b4c0] },
      { id: 'rojizo', name: 'Rojizo', ramp: [0x1a0a10, 0x5a2e22, 0x8f5236, 0xa8643e, 0xd9b08a, 0xf6e6d2] },
    ],
  },
  // Oso: pelaje café (incluye las sombras rojizas del pecho).
  2: {
    stops: [0.15, 0.3, 0.43, 0.5, 0.6, 0.82],
    rules: [{ minS: 0.2, hueFrom: 0, hueTo: 45 }],
    variants: [
      { id: 'polar', name: 'Polar', ramp: [0x2a3040, 0x9aa4b2, 0xd4dae2, 0xe6eaef, 0xf4f6f8, 0xffffff] },
      { id: 'negro', name: 'Negro', ramp: [0x0c0a0c, 0x1e1a1e, 0x2e2a2e, 0x3a3438, 0x5a5054, 0xa89a8c] },
      { id: 'canela', name: 'Canela', ramp: [0x3a1c0c, 0x8a4a20, 0xc27a3a, 0xd48c46, 0xecb06c, 0xfbe0b0] },
    ],
  },
  // Tlacuache: pelaje gris pardo y cara blanca; lo rosa (cola, nariz, orejas) no se toca.
  3: {
    stops: [0.12, 0.22, 0.48, 0.6, 0.72, 0.95],
    rules: [{ maxS: 0.3, minL: 0.12 }],
    variants: [
      { id: 'albino', name: 'Albino', ramp: [0x9a8a90, 0xd8ccd0, 0xf2ece8, 0xf7f2ee, 0xfbf8f5, 0xffffff] },
      { id: 'canela', name: 'Canela', ramp: [0x2e1a10, 0x5a3420, 0xb07a50, 0xc28c60, 0xdcb48a, 0xf8ecdc] },
      { id: 'carbon', name: 'Carbón', ramp: [0x0e0c10, 0x1c1820, 0x4a4450, 0x5a5460, 0x8a8490, 0xe8e4ec] },
    ],
  },
  // Manatí: piel azul grisácea con manchas; las mejillas rosas no se tocan.
  4: {
    stops: [0.08, 0.38, 0.51, 0.62, 0.68, 0.78],
    rules: [{ minS: 0.08, hueFrom: 190, hueTo: 255 }],
    variants: [
      { id: 'algas', name: 'Con algas', ramp: [0x0a2416, 0x4a6a4c, 0x6f8f68, 0x8fae86, 0x9cb994, 0xc0d6b6] },
      { id: 'piedra', name: 'Piedra', ramp: [0x1a1a22, 0x5e5e66, 0x82828a, 0xa2a2aa, 0xacacb2, 0xcfcfd4] },
      { id: 'lavanda', name: 'Lavanda', ramp: [0x1e1036, 0x6a5a8e, 0x8d7eae, 0xab9ecb, 0xb4a8d2, 0xd4cae8] },
    ],
  },
};

export function variantsOf(petId: PetId): readonly ColorVariant[] {
  return SPECIES_RAMPS[petId]?.variants ?? [];
}

export function findVariant(petId: PetId, id: string | null | undefined): ColorVariant | null {
  if (!id) return null;
  return SPECIES_RAMPS[petId]?.variants.find((v) => v.id === id) ?? null;
}

/** Color del contorno de una variante (el primer punto de su rampa), para las prendas. */
export const variantOutline = (variant: ColorVariant) => variant.ramp[0];

/** Color representativo de una variante para las muestras de la interfaz (el cuerpo). */
export const variantSwatch = (variant: ColorVariant) => variant.ramp[Math.min(4, variant.ramp.length - 1)];

function inHueRange(h: number, from: number, to: number): boolean {
  return from <= to ? h >= from && h <= to : h >= from || h <= to;
}

function hsl(r8: number, g8: number, b8: number): [number, number, number] {
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1) + 1e-9);
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return [h, s, l];
}

function matches(rule: PixelRule, h: number, s: number, l: number): boolean {
  if (rule.minS !== undefined && s < rule.minS) return false;
  if (rule.maxS !== undefined && s > rule.maxS) return false;
  if (rule.minL !== undefined && l < rule.minL) return false;
  if (rule.hueFrom !== undefined && rule.hueTo !== undefined && !inHueRange(h, rule.hueFrom, rule.hueTo)) return false;
  return true;
}

/** Componentes conexos (4 vecinos) de `mask`. Devuelve la etiqueta de cada píxel (0 = fuera). */
function label(mask: Uint8Array, width: number, height: number): { labels: Int32Array; count: number } {
  const labels = new Int32Array(width * height);
  const queue = new Int32Array(width * height);
  let count = 0;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    count++;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = count;
    while (head < tail) {
      const p = queue[head++];
      const x = p % width;
      const neighbors = [x > 0 ? p - 1 : -1, x + 1 < width ? p + 1 : -1, p - width, p + width];
      for (const n of neighbors) {
        if (n < 0 || n >= mask.length || !mask[n] || labels[n]) continue;
        labels[n] = count;
        queue[tail++] = n;
      }
    }
  }
  return { labels, count };
}

/**
 * Boca y lengua del ajolote: comparten tonos con las branquias, así que se protegen por forma.
 * Se buscan los ojos (manchas casi negras) y se protegen las zonas oscuras o rojas que quedan
 * encerradas en la cara (no tocan lo transparente) y están justo debajo de algún ojo.
 */
export function mouthMask(data: Uint8ClampedArray, width: number, height: number, ramp: SpeciesRamp): Uint8Array {
  const n = width * height;
  const eye = new Uint8Array(n);
  const cand = new Uint8Array(n);
  const opaque = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (data[i + 3] === 0) continue;
    opaque[p] = 1;
    const [h, s, l] = hsl(data[i], data[i + 1], data[i + 2]);
    if (l < 0.15 && s < 0.6) eye[p] = 1;
    if (l < 0.72 && ramp.rules.some((r) => matches(r, h, s, l))) cand[p] = 1;
  }
  const eyes: Array<{ x: number; y: number; w: number; h: number }> = [];
  const e = label(eye, width, height);
  const boxes = new Map<number, { x0: number; y0: number; x1: number; y1: number; size: number }>();
  const grow = (lab: Int32Array) => {
    boxes.clear();
    for (let p = 0; p < n; p++) {
      const k = lab[p];
      if (!k) continue;
      const x = p % width;
      const y = (p - x) / width;
      const b = boxes.get(k);
      if (b) { b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y); b.size++; }
      else boxes.set(k, { x0: x, x1: x, y0: y, y1: y, size: 1 });
    }
  };
  grow(e.labels);
  for (const b of boxes.values()) {
    if (b.size >= 12) eyes.push({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1 });
  }
  const protect = new Uint8Array(n);
  if (eyes.length === 0) return protect;
  const c = label(cand, width, height);
  // Componentes que tocan lo transparente o el borde: son contorno exterior, no la boca.
  const touches = new Set<number>();
  for (let p = 0; p < n; p++) {
    const k = c.labels[p];
    if (!k) continue;
    const x = p % width;
    const y = (p - x) / width;
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) { touches.add(k); continue; }
    if (!opaque[p - 1] || !opaque[p + 1] || !opaque[p - width] || !opaque[p + width]) touches.add(k);
  }
  grow(c.labels);
  const keep = new Set<number>();
  for (const [k, b] of boxes) {
    if (touches.has(k)) continue;
    const cx = (b.x0 + b.x1) / 2;
    const cy = (b.y0 + b.y1) / 2;
    if (eyes.some((ey) => cy - ey.y > 0 && cy - ey.y < 4 * ey.h && Math.abs(cx - ey.x) < 4 * ey.w)) keep.add(k);
  }
  for (let p = 0; p < n; p++) if (keep.has(c.labels[p])) protect[p] = 1;
  return protect;
}

/**
 * Devuelve una copia de los píxeles RGBA con la variante aplicada. `data` no se modifica.
 * El canal alfa se conserva tal cual (bordes y transparencias quedan iguales).
 */
export function recolorPixels(data: Uint8ClampedArray, width: number, height: number, ramp: SpeciesRamp, variant: ColorVariant): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data);
  const { stops } = ramp;
  const last = stops.length - 1;
  const targets = variant.ramp.map((c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255]);
  const protect = ramp.protectMouth ? mouthMask(data, width, height, ramp) : null;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0 || protect?.[i / 4]) continue;
    const [h, s, l] = hsl(data[i], data[i + 1], data[i + 2]);
    if (!ramp.rules.some((r) => matches(r, h, s, l))) continue;
    // Interpolación lineal entre los dos puntos de la rampa que rodean esta luminosidad.
    const x = Math.min(stops[last], Math.max(stops[0], l));
    let k = 0;
    while (k < last - 1 && x > stops[k + 1]) k++;
    const t = (x - stops[k]) / (stops[k + 1] - stops[k]);
    for (let ch = 0; ch < 3; ch++) out[i + ch] = Math.round(targets[k][ch] + (targets[k + 1][ch] - targets[k][ch]) * t);
  }
  return out;
}
