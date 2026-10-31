import type { GameConfig } from './types.ts';

const MINUTE = 60_000;

/** Ritmos para la demo del hackatón: la mascota crece y se descuida en minutos. */
export const DEFAULT_CONFIG: GameConfig = {
  decayPerMinute: { hunger: 6, thirst: 8, energy: 4, happiness: 5, cleanliness: 4 },
  sleepDecayFactor: 0.5,
  sleepEnergyPerMinute: 15,
  teenAtMs: 2 * MINUTE,
  adultAtMs: 5 * MINUTE,
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
