import { describe, expect, it } from 'vitest';
import { configForPet, DEFAULT_CONFIG, withLife } from './config.ts';
import { computeStats, createPet, deathTime, eatSpecial, feed, isDead, markDeadIfNeeded } from './petState.ts';
import { DROP_INTERVAL_MS, dropsAvailable, FOOD_CATALOG, foodEffects, pickDrop } from './pantry.ts';
import { parsePetState } from './storage.ts';
import { SHOP_CATALOG } from './shop.ts';
import { buildTopHat, HAT_SIZES, HEAD_ANCHORS, PX } from './wearables.ts';
import { recolorPixels, SPECIES_RAMPS, variantsOf } from './variants.ts';

const HOUR = 3_600_000;

describe('dificultad y modos', () => {
  for (const hours of [1, 7, 12] as const) {
    it(`en competencia sin cuidados muere a las ${hours} h (±1 %)`, () => {
      const pet = createPet(0, 'Axo', 0, { lifeHours: hours, peaceful: false });
      const config = configForPet(pet);
      const at = deathTime(pet, 30 * HOUR, config);
      expect(Math.abs(at - hours * HOUR) / (hours * HOUR)).toBeLessThan(0.01);
      expect(isDead(pet, hours * HOUR * 0.98, config)).toBe(false);
      expect(isDead(pet, hours * HOUR * 1.02, config)).toBe(true);
    });
  }

  it('en modo pacífico nunca muere y se puede volver a cuidar', () => {
    const pet = createPet(1, 'Lobo', 0, { lifeHours: 1, peaceful: true });
    const config = configForPet(pet);
    expect(config.canDie).toBe(false);
    const much = 100 * HOUR;
    expect(isDead(pet, much, config)).toBe(false);
    expect(markDeadIfNeeded(pet, much, config)).toBe(pet);
    expect(computeStats(pet, much, config).health).toBe(0);
    const fed = feed(pet, 'apple', much, config);
    expect(fed).not.toBe(pet);
    expect(computeStats(fed, much, config).hunger).toBeGreaterThan(0);
  });

  it('las partidas viejas conservan 11 h y pueden morir', () => {
    const old = parsePetState(JSON.stringify({ version: 2, petId: 0, name: 'A', bornAt: 0, updatedAt: 0, needs: { hunger: 80, thirst: 80, energy: 80, happiness: 80, cleanliness: 80 }, sleeping: false, diedAt: null }))!;
    expect(old.lifeHours).toBeUndefined();
    const config = configForPet(old);
    expect(config.canDie).toBe(true);
    expect(config.decayPerMinute).toEqual(DEFAULT_CONFIG.decayPerMinute);
  });

  it('guarda y lee dificultad, modo y color; ignora valores inválidos', () => {
    const pet = createPet(3, 'T', 5, { lifeHours: 12, peaceful: true, variant: 'albino' });
    const back = parsePetState(JSON.stringify(pet))!;
    expect(back.lifeHours).toBe(12);
    expect(back.peaceful).toBe(true);
    expect(back.variant).toBe('albino');
    const bad = parsePetState(JSON.stringify({ ...pet, lifeHours: 5, variant: 7 }))!;
    expect(bad.lifeHours).toBeUndefined();
    expect(bad.variant).toBeNull();
  });

  it('withLife escala el ritmo: 1 h baja 11 veces más rápido que 11 h', () => {
    const one = withLife(DEFAULT_CONFIG, 1);
    expect(one.decayPerMinute.hunger / DEFAULT_CONFIG.decayPerMinute.hunger).toBeCloseTo(11);
  });
});

describe('despensa y regalos', () => {
  it('un regalo por cada intervalo vivido, menos los ya abiertos', () => {
    expect(dropsAvailable(0, 0)).toBe(0);
    expect(dropsAvailable(DROP_INTERVAL_MS - 1, 0)).toBe(0);
    expect(dropsAvailable(DROP_INTERVAL_MS, 0)).toBe(1);
    expect(dropsAvailable(5 * DROP_INTERVAL_MS + 10, 2)).toBe(3);
    expect(dropsAvailable(DROP_INTERVAL_MS, 9)).toBe(0);
    expect(dropsAvailable(Number.NaN, 0)).toBe(0);
    expect(dropsAvailable(DROP_INTERVAL_MS, -3)).toBe(1);
  });

  it('pickDrop siempre devuelve una comida del catálogo, incluso en los bordes', () => {
    for (const r of [0, 0.3, 0.999999, 1, -1, Number.NaN]) {
      const food = pickDrop(r);
      expect(FOOD_CATALOG).toContain(food ?? FOOD_CATALOG[0]);
    }
  });

  it('las comidas especiales curan aunque esté dormida y suben las necesidades', () => {
    const pet = { ...createPet(0, 'A', 0, { lifeHours: 7 }), sleeping: true };
    const config = configForPet(pet);
    const tamal = FOOD_CATALOG.find((f) => f.id === 'food:tamal')!;
    const after = eatSpecial(pet, foodEffects(tamal), 3 * HOUR, config);
    expect(after.sleeping).toBe(false);
    expect(computeStats(after, 3 * HOUR, config).health).toBeGreaterThan(computeStats(pet, 3 * HOUR, config).health);
  });

  it('los ids de comida coinciden con el contrato (25 a 31) y no chocan con la tienda', () => {
    const ids = FOOD_CATALOG.map((f) => f.articleId);
    expect(ids).toEqual([25, 26, 27, 28, 29, 30, 31]);
    for (const item of SHOP_CATALOG) expect(ids).not.toContain(item.articleId);
    expect(SHOP_CATALOG.every((i) => i.bonus && (i.bonus.coins || i.bonus.happiness))).toBe(true);
  });
});

describe('prendas y variantes', () => {
  it('el sombrero tiene contorno cerrado y su punto de apoyo dentro de la matriz', () => {
    for (const shape of Object.values(HAT_SIZES)) {
      const art = buildTopHat(shape);
      expect(art.pixels.length).toBe(art.width * art.height);
      expect(art.pivot.x).toBeGreaterThan(0);
      expect(art.pivot.y).toBeLessThanOrEqual(art.height);
      // Ningún píxel de color toca el borde de la matriz sin contorno.
      for (let x = 0; x < art.width; x++) {
        expect([PX.empty, PX.outline]).toContain(art.pixels[x]);
        expect([PX.empty, PX.outline]).toContain(art.pixels[(art.height - 1) * art.width + x]);
      }
    }
  });

  it('hay ancla de cabeza para las 5 especies en sus 3 edades', () => {
    for (const id of [0, 1, 2, 3, 4]) for (const stage of ['baby', 'teen', 'adult'] as const) expect(HEAD_ANCHORS[id][stage]).toBeDefined();
  });

  it('cada especie tiene variantes y recolorear conserva el alfa y lo que no es de la rampa', () => {
    for (const id of [0, 1, 2, 3, 4]) expect(variantsOf(id).length).toBeGreaterThan(0);
    // 2×1 píxeles: un rosa del ajolote y un negro de ojo.
    const data = new Uint8ClampedArray([246, 186, 198, 200, 5, 5, 5, 255]);
    const out = recolorPixels(data, 2, 1, SPECIES_RAMPS[0]!, variantsOf(0)[0]);
    expect(out[3]).toBe(200);
    expect([out[0], out[1], out[2]]).not.toEqual([246, 186, 198]);
    expect([out[4], out[5], out[6], out[7]]).toEqual([5, 5, 5, 255]);
    expect([data[0], data[1], data[2]]).toEqual([246, 186, 198]); // no muta la entrada
  });
});
