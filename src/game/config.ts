import type { GameConfig, LifeHours, PetState } from './types.ts';

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
  canDie: true,
};

/** Horas que aguanta sin cuidados la configuración base (de arriba). */
export const BASE_LIFE_HOURS = 11;

export const DIFFICULTIES: ReadonlyArray<{ hours: LifeHours; label: string; detail: string }> = [
  { hours: 1, label: 'Difícil', detail: 'Aguanta 1 hora sin cuidados.' },
  { hours: 7, label: 'Normal', detail: 'Aguanta 7 horas sin cuidados.' },
  { hours: 12, label: 'Fácil', detail: 'Aguanta 12 horas sin cuidados.' },
];
export const DEFAULT_LIFE_HOURS: LifeHours = 7;
export const isLifeHours = (v: unknown): v is LifeHours => v === 1 || v === 7 || v === 12;

/**
 * Ajusta la configuración a la dificultad: las necesidades bajan más rápido o más lento para que,
 * sin ningún cuidado, la mascota aguante `hours` horas (como el contrato PolkaPets v2).
 */
export function withLife(config: GameConfig, hours: number, peaceful = false): GameConfig {
  const factor = BASE_LIFE_HOURS / hours;
  const decayPerMinute = { ...config.decayPerMinute };
  for (const key of Object.keys(decayPerMinute) as Array<keyof typeof decayPerMinute>) decayPerMinute[key] *= factor;
  return { ...config, decayPerMinute, canDie: !peaceful };
}

/** Configuración de una partida: dificultad y modo de la mascota, y `?speed=` para pruebas. */
export function configForPet(pet: Pick<PetState, 'lifeHours' | 'peaceful'> | null, speed = 1): GameConfig {
  const base = pet?.lifeHours ? withLife(DEFAULT_CONFIG, pet.lifeHours, pet.peaceful === true) : { ...DEFAULT_CONFIG, canDie: pet?.peaceful !== true };
  return withSpeed(base, speed);
}

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
