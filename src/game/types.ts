// Tipos del juego. Sin dependencias de Phaser, DOM, almacenamiento ni Polkadot.

export type NeedKey = 'hunger' | 'thirst' | 'energy' | 'happiness' | 'cleanliness';

/** Necesidades de 0 a 100; 100 es lo mejor (por ejemplo, hunger = 100 significa lleno). */
export type Needs = Record<NeedKey, number>;

/** Necesidades más la vida, que se calcula como el promedio de las necesidades. */
export type Stats = Needs & { health: number };

export type Stage = 'baby' | 'teen' | 'adult';

export type PetId = 0 | 1 | 2 | 3 | 4;

/**
 * Estado guardado. Las necesidades se guardan como valor base en `updatedAt`; el valor actual se
 * calcula con el tiempo transcurrido (misma fórmula que podría usar un contrato con block.timestamp).
 */
export interface PetState {
  version: 2;
  petId: PetId;
  name: string;
  bornAt: number;
  updatedAt: number;
  needs: Needs;
  sleeping: boolean;
  /** Momento en que se detectó la muerte; null mientras vive. */
  diedAt: number | null;
}

export type ItemKind = 'food' | 'drink';

export interface CareItem {
  id: string;
  kind: ItemKind;
  label: string;
  icon: string;
  effects: Partial<Needs>;
}

export interface PetSpecies {
  id: PetId;
  /** Nombre en minúsculas para los archivos de `public/assets/characters/`. */
  slug: string;
  label: string;
  description: string;
  /** Color base del tema de la interfaz; distinto para cada mascota. */
  theme: number;
  /** Colores del marcador temporal mientras no haya sprites. */
  color: number;
  outline: number;
  belly: number;
}

export interface GameConfig {
  /** Puntos que baja cada necesidad por minuto estando despierta. */
  decayPerMinute: Needs;
  /** Multiplicador de bajada mientras duerme. */
  sleepDecayFactor: number;
  /** Puntos de energía que recupera por minuto mientras duerme. */
  sleepEnergyPerMinute: number;
  /** Edad (ms) a la que pasa de bebé a adolescente y de adolescente a adulto. */
  teenAtMs: number;
  adultAtMs: number;
  /** Limpieza máxima que da un baño completo (100 % frotado). */
  bathMaxGain: number;
  /** Debajo de este valor una necesidad se considera crítica (mascota triste, barra roja). */
  lowThreshold: number;
}
