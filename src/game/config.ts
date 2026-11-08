import type { GameConfig } from './types.ts';

const MINUTE = 60_000;

/** Las necesidades empiezan en 80 (petState.ts). Ritmo = 80 puntos en los minutos indicados. */
const zeroIn = (minutes: number) => 80 / minutes;

/**
 * Sin cuidados y despierta, cada necesidad llega a 0 en: sed 9 h, felicidad 10 h, hambre,
 * energía y limpieza 11 h. Muere cuando hambre y sed están en 0 a la vez, o cuando la vida (el
 * promedio) llega a 0: las dos cosas pasan a las 11 h. Dormida todo baja a la mitad (22 h).
 */
export const DEFAULT_CONFIG: GameConfig = {
  decayPerMinute: {
    hunger: zeroIn(660), thirst: zeroIn(540), energy: zeroIn(660), happiness: zeroIn(600), cleanliness: zeroIn(660),
  },
  sleepDecayFactor: 0.5,
  sleepEnergyPerMinute: 15,
  // Bebé la primera hora, adolescente hasta las 4 h y después adulta (vive 11 h sin cuidados).
  teenAtMs: 60 * MINUTE,
  adultAtMs: 4 * 60 * MINUTE,
  bathMaxGain: 70,
  lowThreshold: 30,
};

/**
 * Acelera o frena el tiempo del juego para probar etapas y muerte (`?speed=10` en la URL).
 * Solo cambia ritmos y umbrales; las fórmulas son las mismas.
 */
export function withSpeed(config: GameConfig, speed: number): GameConfig {
  const s = Number.isFinite(speed) && speed > 0 ? speed : 1;
  const decayPerMinute = { ...config.decayPerMinute };
  for (const key of Object.keys(decayPerMinute) as Array<keyof typeof decayPerMinute>) {
    decayPerMinute[key] *= s;
  }
  return {
    ...config,
    decayPerMinute,
    sleepEnergyPerMinute: config.sleepEnergyPerMinute * s,
    teenAtMs: config.teenAtMs / s,
    adultAtMs: config.adultAtMs / s,
  };
}
