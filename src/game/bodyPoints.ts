// Puntos del cuerpo para ponerle accesorios a la mascota. Lógica pura: sin Phaser, DOM ni Polkadot.
//
// Cada accesorio va en su lugar (cabeza, a un lado de la cabeza, ojos o cuello) y sigue a la
// ilustración en cada cuadro. El bebé ajolote cambia de postura entre cuadros (se acuesta, se
// inclina), así que tiene un punto por cuadro; las demás ilustraciones son de una sola imagen.
// Coordenadas en píxeles de la imagen original (1254×1254, o el cuadro de 356×276 del bebé ajolote).
import { EYES } from './sleepFace.ts';
import { HEAD_ANCHORS } from './wearables.ts';
import type { PetId, Stage } from './types.ts';

export interface Point { x: number; y: number }

export interface BodyPoints {
  /** Cima de la cabeza (donde se apoya un sombrero o una corona). */
  head: Point;
  /** Centro entre los ojos y distancia entre ellos (para los lentes). */
  eyes: Point & { span: number };
  /** Cuello o pecho, justo debajo de la cara (medallas, cintas). */
  neck: Point;
  /** Inclinación de la cabeza en grados. */
  angle: number;
  /** Píxeles de la imagen por píxel de pixel art (10 en las ilustraciones; 4 en el bebé ajolote). */
  block: number;
}

/** Bebé ajolote, cuadro por cuadro (medido sobre la hoja `animations.png`): cabeza, ojos y separación. */
const BABY_AXOLOTL: ReadonlyArray<{ hx: number; top: number; ex: number; ey: number; span: number }> = [
  { hx: 175, top: 85, ex: 167, ey: 147, span: 78 }, // 0 reposo
  { hx: 177, top: 85, ex: 164, ey: 148, span: 74 },
  { hx: 170, top: 86, ex: 170, ey: 162, span: 100 },
  { hx: 160, top: 82, ex: 142, ey: 148, span: 80 },
  { hx: 185, top: 84, ex: 171, ey: 145, span: 82 }, // 4 jugar
  { hx: 175, top: 66, ex: 171, ey: 124, span: 95 },
  { hx: 166, top: 79, ex: 160, ey: 137, span: 80 },
  { hx: 172, top: 86, ex: 157, ey: 148, span: 90 },
  { hx: 197, top: 80, ex: 185, ey: 145, span: 74 }, // 8 comer
  { hx: 175, top: 78, ex: 172, ey: 145, span: 73 },
  { hx: 173, top: 83, ex: 167, ey: 160, span: 78 },
  { hx: 167, top: 78, ex: 150, ey: 138, span: 65 },
  { hx: 162, top: 92, ex: 152, ey: 167, span: 75 }, // 12 dormir (acostado)
  { hx: 160, top: 84, ex: 149, ey: 171, span: 80 },
  { hx: 150, top: 87, ex: 150, ey: 170, span: 70 },
  { hx: 150, top: 84, ex: 118, ey: 166, span: 72 },
];

/** Cuello de las ilustraciones grandes del ajolote (frente): justo debajo de la barbilla. */
const AXOLOTL_NECK: Partial<Record<Stage, Point>> = { teen: { x: 460, y: 740 }, adult: { x: 470, y: 725 } };

const center = (boxes: readonly (readonly [number, number, number, number])[]) => {
  const xs = boxes.map((b) => (b[1] + b[3]) / 2);
  const ys = boxes.map((b) => (b[0] + b[2]) / 2);
  const x = xs.reduce((a, b) => a + b, 0) / xs.length;
  const y = ys.reduce((a, b) => a + b, 0) / ys.length;
  const span = xs.length > 1 ? Math.abs(xs[0] - xs[1]) : 80;
  const eyeH = Math.max(...boxes.map((b) => b[2] - b[0]));
  return { x, y, span, eyeH };
};

/** Puntos del cuerpo de una ilustración (y del cuadro `frame` en la hoja del bebé ajolote). */
export function bodyPoints(petId: PetId, stage: Stage, frame = 0): BodyPoints | null {
  const anchor = HEAD_ANCHORS[petId]?.[stage];
  if (!anchor) return null;
  if (petId === 0 && stage === 'baby') {
    const f = BABY_AXOLOTL[Math.max(0, Math.min(BABY_AXOLOTL.length - 1, Math.floor(frame)))];
    return {
      head: { x: f.hx, y: f.top + 10 },
      eyes: { x: f.ex, y: f.ey, span: f.span },
      neck: { x: f.ex, y: f.ey + 58 },
      angle: 0,
      block: anchor.block ?? 4,
    };
  }
  const eyes = EYES[petId]?.[stage];
  const c = eyes?.length ? center(eyes) : { x: anchor.x, y: anchor.y + 160, span: 90, eyeH: 60 };
  const neck = (petId === 0 ? AXOLOTL_NECK[stage] : undefined)
    // De lado (lobo, oso, tlacuache, manatí): el cuello queda abajo y hacia el cuerpo.
    ?? { x: c.x - c.span * 0.4, y: c.y + c.eyeH * 3.2 };
  return {
    head: { x: anchor.x, y: anchor.y },
    eyes: { x: c.x, y: c.y, span: c.span },
    neck,
    angle: anchor.angle,
    block: anchor.block ?? 10,
  };
}

/** Lugar del cuerpo de cada accesorio de la tienda (los que no aparecen van en la cabeza). */
export type Slot = 'head' | 'headSide' | 'eyes' | 'neck';

const SLOTS: Readonly<Record<string, Slot>> = {
  'shop:corona': 'head', 'demo:corona': 'head',
  'shop:mono': 'headSide', 'demo:moño': 'headSide', 'shop:flor': 'headSide', 'shop:estrella': 'headSide',
  'shop:lentes': 'eyes',
  'shop:medalla': 'neck', 'shop:cinta': 'neck', 'shop:amuleto': 'neck',
};

export const slotOf = (itemId: string | null | undefined): Slot => (itemId ? SLOTS[itemId] ?? 'head' : 'head');

/**
 * Dónde y de qué tamaño va un accesorio: punto (centro del ícono), ancho en píxeles de la imagen y
 * origen vertical (1 = se apoya por abajo, 0.5 = centrado).
 */
export function placeAccessory(p: BodyPoints, slot: Slot): { x: number; y: number; width: number; originY: number } {
  const unit = p.block * 16; // un ícono de 16 píxeles de pixel art, del tamaño de píxel de la mascota
  switch (slot) {
    case 'eyes': return { x: p.eyes.x, y: p.eyes.y, width: Math.max(unit, p.eyes.span * 1.7), originY: 0.5 };
    case 'neck': return { x: p.neck.x, y: p.neck.y, width: unit * 0.85, originY: 0.5 };
    case 'headSide': return { x: p.head.x + p.eyes.span * 0.3, y: p.head.y + unit * 0.35, width: unit * 1.25, originY: 1 };
    default: return { x: p.head.x, y: p.head.y + unit * 0.2, width: unit, originY: 1 };
  }
}
