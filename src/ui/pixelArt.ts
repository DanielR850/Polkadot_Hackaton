// Íconos de pixel art generados con código. Cada emoji del catálogo (objetos, muebles, comida) se
// dibuja a baja resolución, se reduce a la paleta del juego y se le pone el contorno oscuro de las
// mascotas. Así toda la interfaz comparte el mismo estilo retro en lugar de mezclar emoji del
// sistema. La parte de color (`pixelateRgba`) es pura y se prueba sin navegador.

/** Paleta del juego: tinta, papel, la paleta mexicana de la habitación y neutros para sombras. */
export const GAME_PALETTE: readonly number[] = [
  0x302b43, 0x5c4a2c, 0x8a6205, 0xd79909, 0xf5c451, 0xfff7e6, 0xffffff,
  0xe4007c, 0xf3a6c8, 0xd7263d, 0x9c1a2c, 0xff8c1a, 0xffd23f, 0xc0643c, 0x7a3b1d,
  0x2e9e4f, 0x6fae4f, 0x14532a, 0x00a6a6, 0x8fd3d6, 0x1f4fa3, 0x6f9be0, 0x7b2d8e, 0xb276c4,
  0x9aa0a8, 0xd6d2da, 0x5e5e66, 0xf6e7c8, 0xebb592,
];

/** Color del contorno (la tinta del juego). */
export const OUTLINE = 0x302b43;

const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255] as const;

/** Color de la paleta más cercano (distancia ponderada por la percepción del ojo). */
export function nearest(r: number, g: number, b: number, palette: readonly number[] = GAME_PALETTE): number {
  let best = palette[0];
  let bestD = Infinity;
  for (const c of palette) {
    const [pr, pg, pb] = rgb(c);
    const d = 2 * (r - pr) ** 2 + 4 * (g - pg) ** 2 + 3 * (b - pb) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

/**
 * Convierte un dibujo RGBA de `size`×`size` en pixel art de (`size`+2)² con la paleta del juego y
 * contorno de 1 píxel. Lo semitransparente (antialias) se decide por umbral: no quedan bordes borrosos.
 */
export function pixelateRgba(src: Uint8ClampedArray, size: number, palette: readonly number[] = GAME_PALETTE, alphaCut = 110): Uint8ClampedArray {
  const out = size + 2;
  const dst = new Uint8ClampedArray(out * out * 4);
  const filled = new Uint8Array(out * out);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    if (src[i + 3] < alphaCut) continue;
    const c = nearest(src[i], src[i + 1], src[i + 2], palette);
    const p = (y + 1) * out + (x + 1);
    filled[p] = 1;
    const [r, g, b] = rgb(c);
    dst[p * 4] = r; dst[p * 4 + 1] = g; dst[p * 4 + 2] = b; dst[p * 4 + 3] = 255;
  }
  const [or, og, ob] = rgb(OUTLINE);
  for (let y = 0; y < out; y++) for (let x = 0; x < out; x++) {
    const p = y * out + x;
    if (filled[p]) continue;
    const touches = (x > 0 && filled[p - 1]) || (x < out - 1 && filled[p + 1]) || (y > 0 && filled[p - out]) || (y < out - 1 && filled[p + out]);
    if (!touches) continue;
    dst[p * 4] = or; dst[p * 4 + 1] = og; dst[p * 4 + 2] = ob; dst[p * 4 + 3] = 255;
  }
  return dst;
}

/* ------------------------------------------------------------ navegador */

/** Resolución lógica de los íconos (sin contar el contorno). */
export const ICON_SIZE = 14;
const canvases = new Map<string, HTMLCanvasElement | null>();

/**
 * Lienzo de (ICON_SIZE+2)² con el ícono en pixel art, o null si el navegador no puede dibujar.
 * Se calcula una sola vez por emoji.
 */
export function pixelIconCanvas(emoji: string): HTMLCanvasElement | null {
  if (canvases.has(emoji)) return canvases.get(emoji)!;
  let result: HTMLCanvasElement | null = null;
  try {
    const draw = document.createElement('canvas');
    draw.width = ICON_SIZE;
    draw.height = ICON_SIZE;
    const ctx = draw.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${Math.round(ICON_SIZE * 0.92)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
      ctx.fillText(emoji, ICON_SIZE / 2, ICON_SIZE / 2 + 1);
      const src = ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE).data;
      const px = pixelateRgba(src, ICON_SIZE);
      if (px.some((v, i) => i % 4 === 3 && v > 0)) {
        const out = document.createElement('canvas');
        out.width = ICON_SIZE + 2;
        out.height = ICON_SIZE + 2;
        const img = out.getContext("2d")!.createImageData(ICON_SIZE + 2, ICON_SIZE + 2);
        img.data.set(px);
        out.getContext("2d")!.putImageData(img, 0, 0);
        result = out;
      }
    }
  } catch { /* sin canvas: se usa el emoji */ }
  canvases.set(emoji, result);
  return result;
}

const urls = new Map<string, string | null>();

/** URL de imagen del ícono en pixel art (para `<img>`), o null para usar el emoji tal cual. */
export function pixelIconUrl(emoji: string): string | null {
  if (urls.has(emoji)) return urls.get(emoji)!;
  const canvas = pixelIconCanvas(emoji);
  const url = canvas ? canvas.toDataURL('image/png') : null;
  urls.set(emoji, url);
  return url;
}

/** Elemento del ícono: la imagen de pixel art y, si no se puede, el emoji. */
export function pixelIcon(emoji: string, className = 'px-icon'): HTMLElement {
  const url = pixelIconUrl(emoji);
  const span = document.createElement('span');
  span.className = className;
  span.setAttribute('aria-hidden', 'true');
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.draggable = false;
    span.append(img);
  } else {
    span.textContent = emoji;
  }
  return span;
}
