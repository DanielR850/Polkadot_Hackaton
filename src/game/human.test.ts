import { describe, expect, it } from 'vitest';
import { LINES, say, sayAs } from './voice.ts';
import { addRecord, HISTORY_MAX, loadHistory, saveHistory, summarize, type PetRecord } from './history.ts';
import { closeEyes, EYES } from './sleepFace.ts';
import { buildPalette, toRealPixelArt } from './pixelStyle.ts';
import { bodyPoints, placeAccessory, slotOf } from './bodyPoints.ts';
import { happinessFor, MINI_GAMES } from './minigames/rules.ts';

const EMOJI = /\p{Extended_Pictographic}/u;

describe('voz de la mascota', () => {
  it('todas las situaciones tienen frases cortas y sin emoji', () => {
    for (const [moment, lines] of Object.entries(LINES)) {
      expect(lines.length, moment).toBeGreaterThan(0);
      for (const l of lines) {
        expect(EMOJI.test(l), l).toBe(false);
        expect(l.length, l).toBeLessThanOrEqual(48);
      }
    }
  });

  it('la frase cambia con la semilla y es estable con la misma', () => {
    expect(say('happy', 3)).toBe(say('happy', 3));
    const all = new Set(Array.from({ length: 10 }, (_, i) => say('happy', i)));
    expect(all.size).toBeGreaterThan(1);
    expect(say('hungry', -7)).toBeTruthy();
    expect(sayAs('Axo', 'fed', 0)).toMatch(/^Axo: «.+»$/);
  });
});

describe('Mis animales (historial)', () => {
  const rec = (id: string, aliveMs: number, petId = 0): PetRecord => ({
    id, name: id, petId, variant: null, peaceful: true, bornAt: 0, endedAt: aliveMs, diedAt: null, aliveMs,
  });

  it('agrega al principio, no duplica y limita el tamaño', () => {
    let list = addRecord([], rec('a', 10));
    list = addRecord(list, rec('b', 20));
    list = addRecord(list, rec('a', 30));
    expect(list.map((r) => r.id)).toEqual(['a', 'b']);
    expect(list[0].aliveMs).toBe(30);
    for (let i = 0; i < HISTORY_MAX + 5; i++) list = addRecord(list, rec(`x${i}`, i));
    expect(list.length).toBe(HISTORY_MAX);
  });

  it('resume total, el que más vivió y por especie', () => {
    const s = summarize([rec('a', 10, 0), rec('b', 99, 1), rec('c', 5, 1)]);
    expect(s.total).toBe(3);
    expect(s.best?.id).toBe('b');
    expect(s.bySpecies).toEqual({ 0: 1, 1: 2 });
    expect(summarize([]).best).toBeNull();
  });

  it('se guarda y descarta registros dañados', () => {
    saveHistory([rec('ok', 1), { id: 3 } as never]);
    expect(loadHistory().map((r) => r.id)).toEqual(['ok']);
  });
});

describe('cara dormida', () => {
  it('hay ojos medidos para todas las ilustraciones de una sola imagen', () => {
    for (const id of [1, 2, 3, 4]) for (const st of ['baby', 'teen', 'adult'] as const) expect(EYES[id]?.[st]?.length).toBe(2);
    expect(EYES[0]?.teen?.length).toBe(2);
    expect(EYES[0]?.adult?.length).toBe(2);
    expect(EYES[0]?.baby).toBeUndefined(); // el bebé ajolote tiene cuadros de dormir
  });

  it('borra el ojo con el color de la piel y dibuja el párpado', () => {
    const w = 30;
    const d = new Uint8ClampedArray(w * w * 4);
    for (let i = 0; i < w * w; i++) { d[i * 4] = 240; d[i * 4 + 1] = 180; d[i * 4 + 2] = 190; d[i * 4 + 3] = 255; }
    for (let y = 10; y < 20; y++) for (let x = 10; x < 18; x++) { const i = (y * w + x) * 4; d[i] = 5; d[i + 1] = 5; d[i + 2] = 5; }
    const out = closeEyes(d, w, w, [[10, 10, 20, 18]]);
    const at = (x: number, y: number) => { const i = (y * w + x) * 4; return [out[i], out[i + 1], out[i + 2]]; };
    expect(at(11, 11)).not.toEqual([5, 5, 5]); // ya no hay ojo negro arriba
    expect([...Array(10).keys()].some((k) => at(14, 10 + k).join() === '45,25,35')).toBe(true); // párpado
    expect(d[(11 * w + 11) * 4]).toBe(5); // la entrada no cambia
  });
});

describe('pixel real', () => {
  it('cada bloque queda de un solo color y la transparencia por bloque', () => {
    const w = 20;
    const d = new Uint8ClampedArray(w * w * 4);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 20; x++) { const i = (y * w + x) * 4; d[i] = 200 + (x % 3); d[i + 1] = 100; d[i + 2] = 50; d[i + 3] = 255; }
    const out = toRealPixelArt(d, w, w, { block: 10, colors: 4, ink: 0x2b1d33 });
    const px = (x: number, y: number) => [...out.slice((y * w + x) * 4, (y * w + x) * 4 + 4)];
    expect(px(0, 0)).toEqual(px(9, 9)); // un bloque, un color
    expect(px(5, 15)[3]).toBe(0); // bloque vacío: transparente
  });

  it('los casi negros se vuelven la tinta del contorno', () => {
    const w = 10;
    const d = new Uint8ClampedArray(w * w * 4);
    for (let i = 0; i < w * w; i++) { d[i * 4] = 10; d[i * 4 + 1] = 12; d[i * 4 + 2] = 20; d[i * 4 + 3] = 255; }
    const out = toRealPixelArt(d, w, w, { block: 10, colors: 4, ink: 0x2b1d33 });
    expect([out[0], out[1], out[2]]).toEqual([0x2b, 0x1d, 0x33]);
  });

  it('la paleta tiene a lo más k colores y no falla sin muestras', () => {
    expect(buildPalette([], 8)).toEqual([]);
    const samples = Array.from({ length: 50 }, (_, i) => [i * 5, 100, 200 - i] as [number, number, number]);
    expect(buildPalette(samples, 6).length).toBe(6);
  });
});

describe('accesorios en su lugar', () => {
  it('cada especie y edad tiene cabeza, ojos y cuello; el bebé ajolote, por cuadro', () => {
    for (const id of [0, 1, 2, 3, 4]) for (const st of ['baby', 'teen', 'adult'] as const) expect(bodyPoints(id, st)).not.toBeNull();
    const f0 = bodyPoints(0, 'baby', 0)!;
    const f12 = bodyPoints(0, 'baby', 12)!; // acostado: la cabeza baja
    expect(f12.head.y).toBeGreaterThan(f0.head.y);
    expect(bodyPoints(0, 'baby', 99)).not.toBeNull(); // cuadro fuera de rango: no falla
  });

  it('lentes en los ojos, medalla en el cuello y corona arriba', () => {
    const p = bodyPoints(0, 'adult')!;
    expect(slotOf('shop:lentes')).toBe('eyes');
    expect(slotOf('shop:medalla')).toBe('neck');
    expect(slotOf('shop:corona')).toBe('head');
    expect(slotOf(null)).toBe('head');
    const eyes = placeAccessory(p, 'eyes');
    const neck = placeAccessory(p, 'neck');
    const head = placeAccessory(p, 'head');
    expect(eyes.y).toBeCloseTo(p.eyes.y);
    expect(neck.y).toBeGreaterThan(eyes.y);
    expect(head.y).toBeLessThan(eyes.y);
    expect(eyes.width).toBeGreaterThanOrEqual(p.eyes.span);
  });
});

describe('Atrapa la pelota', () => {
  it('está junto a los minijuegos de Ana y da más felicidad con más pelotas', () => {
    expect(MINI_GAMES.map((g) => g.id)).toEqual(['catch', 'pong', 'ball']);
    expect(happinessFor({ game: 'ball', score: 5, coins: 7 })).toBe(30);
    expect(happinessFor({ game: 'ball', score: 1, coins: 1 })).toBe(10);
    expect(happinessFor({ game: 'ball', score: 0, coins: 0 })).toBe(5);
  });
});

describe('ropa mexicana', () => {
  it('cada prenda y talla se genera con contorno, franjas o color, sin salirse de la matriz', async () => {
    const { buildCloth, clothColor, CLOTH_SLOT } = await import('./clothes.ts');
    const { HAT_PALETTES } = await import('./wearables.ts');
    for (const kind of ['charro', 'poncho', 'paliacate', 'rebozo'] as const) {
      const sizes = (['s', 'm', 'l'] as const).map((size) => buildCloth(kind, size));
      expect(sizes[2].width).toBeGreaterThan(sizes[0].width);
      for (const art of sizes) {
        expect(art.pixels.length).toBe(art.width * art.height);
        expect(art.pixels.includes(1)).toBe(true); // contorno
        for (const i of art.pixels) if (i) expect(clothColor(i, HAT_PALETTES[0], 0x2b1d33)).not.toBeNull();
      }
    }
    expect(CLOTH_SLOT.charro).toBe('head');
    expect(CLOTH_SLOT.poncho).toBe('neck');
  });

  it('se puede llevar sombrero y una prenda a la vez, pero no dos prendas', async () => {
    const { sanitize, DEMO_ITEMS, NOTHING_EQUIPPED } = await import('./inventory.ts');
    const eq = sanitize({ ...NOTHING_EQUIPPED, accessory: 'demo:charro', outfit: 'demo:poncho' }, DEMO_ITEMS);
    expect(eq.accessory).toBe('demo:charro');
    expect(eq.outfit).toBe('demo:poncho');
    expect(sanitize({ ...NOTHING_EQUIPPED, outfit: 'demo:charro' }, DEMO_ITEMS).outfit).toBeNull();
  });
});
