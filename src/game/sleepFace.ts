// Cara dormida generada con código. Lógica pura: no importa Phaser, DOM ni Polkadot.
//
// El bebé ajolote tiene cuadros dibujados para dormir; las demás ilustraciones son una sola imagen
// con los ojos abiertos, así que dormidas no parecían dormidas. Aquí se cierran los ojos sobre la
// ilustración original: se borra el ojo rellenando cada fila con el degradado de la piel que lo
// rodea (no con un parche plano) y se dibuja un párpado curvo (︶) del grosor de su píxel.
import type { PetId, Stage } from './types.ts';

/** Recuadro de un ojo en la imagen original: [y0, x0, y1, x1) en píxeles. */
export type EyeBox = readonly [number, number, number, number];

/**
 * Ojos de cada ilustración de 1254×1254, medidos sobre `public/assets/pets/<especie>/<etapa>.png`
 * (detección de mancha oscura con brillo y revisión visual). El ajolote bebé usa sus cuadros.
 */
export const EYES: Partial<Record<PetId, Partial<Record<Stage, readonly EyeBox[]>>>> = {
  0: { teen: [[457, 306, 549, 375], [474, 584, 572, 670]], adult: [[466, 521, 558, 603], [453, 240, 541, 311]] },
  1: {
    baby: [[479, 747, 584, 860], [445, 938, 540, 1005]],
    teen: [[399, 792, 493, 894], [371, 966, 461, 1035]],
    adult: [[272, 914, 343, 997], [255, 1058, 325, 1116]],
  },
  2: {
    baby: [[454, 955, 544, 1002], [484, 775, 582, 856]],
    teen: [[351, 985, 430, 1036], [377, 821, 467, 897]],
    adult: [[226, 1056, 294, 1103], [240, 907, 321, 976]],
  },
  3: {
    baby: [[576, 835, 671, 938], [551, 1050, 605, 1081]],
    teen: [[448, 859, 540, 957], [428, 1035, 486, 1070]],
    adult: [[405, 913, 486, 1000], [389, 1096, 446, 1127]],
  },
  4: {
    baby: [[492, 852, 550, 902], [468, 1069, 501, 1095]],
    teen: [[418, 913, 477, 967], [398, 1149, 431, 1175]],
    adult: [[396, 937, 456, 989], [380, 1186, 415, 1212]],
  },
};

/** Color del párpado: la tinta oscura de los contornos. */
const LID = [45, 25, 35] as const;

/**
 * Copia de los píxeles RGBA con los ojos cerrados. `data` no se modifica. Los ojos se buscan dentro
 * de cada recuadro: lo que se aleja del color de la piel (ojo, iris, brillo) se reemplaza fila por
 * fila con la mezcla de los colores de piel de su izquierda y su derecha.
 */
export function closeEyes(data: Uint8ClampedArray, width: number, height: number, eyes: readonly EyeBox[]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data);
  const at = (x: number, y: number) => (y * width + x) * 4;
  for (const [y0, x0, y1, x1] of eyes) {
    const h = y1 - y0;
    const w = x1 - x0;
    if (h <= 0 || w <= 0 || y1 > height || x1 > width) continue;
    // Color de piel de referencia: mediana aproximada (promedio) del borde del recuadro.
    const pad = Math.max(3, Math.floor(h / 4));
    let sr = 0, sg = 0, sb = 0, n = 0;
    for (let y = Math.max(0, y0 - pad); y < Math.min(height, y1 + pad); y++) {
      for (let x = Math.max(0, x0 - pad); x < Math.min(width, x1 + pad); x++) {
        if (y >= y0 && y < y1 && x >= x0 && x < x1) continue;
        const i = at(x, y);
        if (data[i + 3] < 128) continue;
        const l = (Math.max(data[i], data[i + 1], data[i + 2]) + Math.min(data[i], data[i + 1], data[i + 2])) / 510;
        if (l < 0.3) continue;
        sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; n++;
      }
    }
    if (n === 0) continue;
    const skin = [sr / n, sg / n, sb / n];
    const isEye = (i: number) => data[i + 3] >= 128
      && Math.abs(data[i] - skin[0]) + Math.abs(data[i + 1] - skin[1]) + Math.abs(data[i + 2] - skin[2]) > 60;
    // Relleno por filas: entre el primer y el último píxel "de ojo", degradado de los bordes.
    for (let y = y0; y < y1; y++) {
      let first = -1;
      let last = -1;
      for (let x = x0; x < x1; x++) if (isEye(at(x, y))) { if (first < 0) first = x; last = x; }
      if (first < 0) continue;
      // Piel real a cada lado: se busca hacia afuera saltando lo que todavía es ojo u oscuro.
      const skinAt = (start: number, step: number): number[] => {
        for (let k = 0, x = start; k < pad * 4 && x >= 0 && x < width; k++, x += step) {
          const i = at(x, y);
          const l = (Math.max(data[i], data[i + 1], data[i + 2]) + Math.min(data[i], data[i + 1], data[i + 2])) / 510;
          if (data[i + 3] >= 128 && !isEye(i) && l >= 0.3) return [data[i], data[i + 1], data[i + 2]];
        }
        return skin;
      };
      const s = Math.max(0, first - 2);
      const e = Math.min(width - 1, last + 2);
      const from = skinAt(s - 1, -1);
      const to = skinAt(e + 1, 1);
      for (let x = s; x <= e; x++) {
        const t = e === s ? 0.5 : (x - s) / (e - s);
        const i = at(x, y);
        for (let c = 0; c < 3; c++) out[i + c] = Math.round(from[c] + (to[c] - from[c]) * t);
      }
    }
    // Párpado: arco hacia abajo en la mitad inferior del ojo.
    const t = Math.max(4, Math.round(Math.min(h, w) / 6));
    const cx = (x0 + x1 - 1) / 2;
    const half = w / 2;
    for (let x = x0; x < x1; x++) {
      const u = (x - cx) / half;
      const yy = Math.round(y0 + h * 0.45 + h * 0.22 * (1 - u * u));
      for (let k = 0; k < t && yy + k < height; k++) {
        const i = at(x, yy + k);
        out[i] = LID[0]; out[i + 1] = LID[1]; out[i + 2] = LID[2]; out[i + 3] = 255;
      }
    }
  }
  return out;
}
