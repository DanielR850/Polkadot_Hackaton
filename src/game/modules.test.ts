import { describe, expect, it } from 'vitest';
import { GAME_PALETTE, nearest, OUTLINE, pixelateRgba } from '../ui/pixelArt.ts';
import { formatDuration } from '../ui/format.ts';
import { addToPantry, clearPantry, findFoodByArticle, loadPantry, removeFromPantry, savePantry } from './pantry.ts';
import { buildTopHat, findPalette, HAT_PALETTES, HAT_SIZES, headWearFor, isWearable, loadHatPalette, saveHatPalette, wearKey } from './wearables.ts';
import { mouthMask, recolorPixels, SPECIES_RAMPS, variantsOf } from './variants.ts';
import { canBuy, equippedArticleIds, SHOP_CATALOG } from './shop.ts';
import { NOTHING_EQUIPPED } from './inventory.ts';

describe('íconos de pixel art', () => {
  it('nearest elige un color de la paleta', () => {
    for (const [r, g, b] of [[255, 0, 0], [0, 0, 0], [250, 250, 250], [40, 160, 80]]) expect(GAME_PALETTE).toContain(nearest(r, g, b));
    expect(nearest(255, 255, 255)).toBe(0xffffff);
  });

  it('pixelateRgba agrega contorno de 1 píxel y descarta lo casi transparente', () => {
    const size = 3;
    const src = new Uint8ClampedArray(size * size * 4);
    const set = (x: number, y: number, a: number) => { const i = (y * size + x) * 4; src[i] = 228; src[i + 1] = 0; src[i + 2] = 124; src[i + 3] = a; };
    set(1, 1, 255); // centro opaco
    set(0, 0, 60); // antialias: se descarta
    const out = pixelateRgba(src, size);
    const w = size + 2;
    const px = (x: number, y: number) => { const i = (y * w + x) * 4; return [out[i], out[i + 1], out[i + 2], out[i + 3]]; };
    expect(px(2, 2)).toEqual([0xe4, 0x00, 0x7c, 255]); // rosa mexicano de la paleta
    const ink = [(OUTLINE >> 16) & 255, (OUTLINE >> 8) & 255, OUTLINE & 255, 255];
    for (const [x, y] of [[1, 2], [3, 2], [2, 1], [2, 3]]) expect(px(x, y)).toEqual(ink);
    expect(px(1, 1)[3]).toBe(0); // la esquina del antialias quedó transparente
    expect(px(0, 0)[3]).toBe(0);
  });
});

describe('despensa guardada', () => {
  it('guarda, agrega, quita y limpia', () => {
    clearPantry();
    expect(loadPantry()).toEqual({ items: [], dropsTaken: 0 });
    let p = addToPantry(loadPantry(), { uid: 'a', foodId: 'food:tamal' });
    p = addToPantry(p, { uid: 'b', foodId: 'food:elote', tokenId: '7' });
    savePantry({ ...p, dropsTaken: 3 });
    expect(loadPantry().items.map((i) => i.uid)).toEqual(['a', 'b']);
    expect(loadPantry().dropsTaken).toBe(3);
    expect(removeFromPantry(loadPantry(), 'a').items.map((i) => i.uid)).toEqual(['b']);
    clearPantry();
    expect(loadPantry().items).toEqual([]);
  });

  it('ignora comidas desconocidas y contadores inválidos', () => {
    savePantry({ items: [{ uid: 'x', foodId: 'food:veneno' }, { uid: 'y', foodId: 'food:mole' }], dropsTaken: -4 } as never);
    const p = loadPantry();
    expect(p.items.map((i) => i.foodId)).toEqual(['food:mole']);
    expect(p.dropsTaken).toBe(0);
    expect(findFoodByArticle(99)).toBeUndefined();
  });
});

describe('prendas', () => {
  it('solo el sombrero es prenda de pixel art y respeta la paleta elegida', () => {
    expect(isWearable('shop:sombrero')).toBe(true);
    expect(isWearable('shop:corona')).toBe(false);
    expect(isWearable(null)).toBe(false);
    expect(headWearFor('shop:sombrero', 'rosa')).toEqual({ kind: 'top-hat', palette: 'rosa' });
    expect(headWearFor('shop:sombrero', 'no-existe')?.palette).toBe('noche');
    expect(headWearFor('shop:lentes', 'rosa')).toBeNull();
  });

  it('la paleta guardada se valida y cada combinación tiene su textura', () => {
    saveHatPalette('turquesa');
    expect(loadHatPalette()).toBe('turquesa');
    saveHatPalette('<script>');
    expect(loadHatPalette()).toBe(HAT_PALETTES[0].id);
    expect(findPalette('x').id).toBe(HAT_PALETTES[0].id);
    const keys = new Set(HAT_PALETTES.flatMap((p) => (['s', 'm', 'l'] as const).map((size) => wearKey({ kind: 'top-hat', palette: p.id }, size, 0x302b43))));
    expect(keys.size).toBe(HAT_PALETTES.length * 3);
  });

  it('el sombrero grande es más grande que el chico', () => {
    const s = buildTopHat(HAT_SIZES.s);
    const l = buildTopHat(HAT_SIZES.l);
    expect(l.width).toBeGreaterThan(s.width);
    expect(l.height).toBeGreaterThan(s.height);
  });
});

describe('variantes: la boca del ajolote', () => {
  /** Cara rosa 20×20 con dos ojos negros y una boca roja encerrada debajo. */
  function face(): Uint8ClampedArray {
    const w = 20;
    const d = new Uint8ClampedArray(w * w * 4);
    const put = (x: number, y: number, c: [number, number, number]) => { const i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; };
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) put(x, y, [246, 186, 198]);
    for (const ex of [5, 13]) for (let y = 5; y < 9; y++) for (let x = ex; x < ex + 3; x++) put(x, y, [8, 8, 8]);
    for (let y = 12; y < 15; y++) for (let x = 8; x < 12; x++) put(x, y, [222, 6, 54]);
    return d;
  }

  it('protege la boca encerrada bajo los ojos y recolorea el resto', () => {
    const data = face();
    const ramp = SPECIES_RAMPS[0]!;
    const mask = mouthMask(data, 20, 20, ramp);
    expect(mask[13 * 20 + 9]).toBe(1); // boca
    expect(mask[2 * 20 + 2]).toBe(0); // cara
    const out = recolorPixels(data, 20, 20, ramp, variantsOf(0)[0]);
    const i = (13 * 20 + 9) * 4;
    expect([out[i], out[i + 1], out[i + 2]]).toEqual([222, 6, 54]); // la boca queda roja
    const j = (2 * 20 + 2) * 4;
    expect([out[j], out[j + 1], out[j + 2]]).not.toEqual([246, 186, 198]); // la cara cambia
  });

  it('sin ojos no protege nada', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4).fill(255);
    expect(mouthMask(data, 4, 4, SPECIES_RAMPS[0]!).every((v) => v === 0)).toBe(true);
  });
});

describe('tienda e inventario', () => {
  it('no se compra lo exclusivo, lo repetido ni sin pesitos', () => {
    const corona = SHOP_CATALOG.find((i) => i.id === 'shop:corona')!;
    const medalla = SHOP_CATALOG.find((i) => i.id === 'shop:medalla')!;
    expect(canBuy(corona, 10, []).ok).toBe(false);
    expect(canBuy(corona, 500, []).ok).toBe(true);
    expect(canBuy(corona, 500, ['shop:corona']).ok).toBe(false);
    expect(canBuy(medalla, 999, []).ok).toBe(false);
  });

  it('lo puesto se traduce a ids del contrato', () => {
    expect(equippedArticleIds({ ...NOTHING_EQUIPPED, accessory: 'shop:sombrero', furniture: ['shop:cama'] })).toEqual([1, 17]);
    expect(equippedArticleIds(NOTHING_EQUIPPED)).toEqual([]);
  });
});

describe('formato de duración', () => {
  it('segundos, minutos, horas y días', () => {
    expect(formatDuration(-5)).toBe('0 s');
    expect(formatDuration(42_000)).toBe('42 s');
    expect(formatDuration(3 * 60_000 + 5000)).toBe('3 min 5 s');
    expect(formatDuration(2 * 3_600_000 + 60_000)).toBe('2 h 1 min');
    expect(formatDuration(53 * 3_600_000)).toBe('2 d 5 h');
  });
});
