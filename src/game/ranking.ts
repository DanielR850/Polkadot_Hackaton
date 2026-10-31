import type { PetId } from './types.ts';

export interface RankingEntry {
  id: string;
  petName: string;
  petId: PetId;
  /** Tiempo vivido en ms; es el criterio del ranking. */
  aliveMs: number;
  isMine: boolean;
}

/**
 * Fuente de datos del ranking. Hoy la implementa `createMockRanking`; después un adaptador en
 * `src/polkadot/` puede leerla del contrato sin cambiar la interfaz.
 */
export interface RankingSource {
  getTop(): Promise<RankingEntry[]>;
}

export function sortRanking(entries: readonly RankingEntry[]): RankingEntry[] {
  return [...entries].sort((a, b) => b.aliveMs - a.aliveMs || a.petName.localeCompare(b.petName));
}

const MINUTE = 60_000;
const FAKE: ReadonlyArray<Omit<RankingEntry, 'isMine'>> = [
  { id: 'f1', petName: 'Mochi', petId: 0, aliveMs: 42 * MINUTE },
  { id: 'f2', petName: 'Kiwi', petId: 1, aliveMs: 31 * MINUTE },
  { id: 'f3', petName: 'Tofu', petId: 2, aliveMs: 27 * MINUTE },
  { id: 'f4', petName: 'Luna', petId: 3, aliveMs: 19 * MINUTE },
  { id: 'f5', petName: 'Pixel', petId: 4, aliveMs: 15 * MINUTE },
  { id: 'f6', petName: 'Nube', petId: 0, aliveMs: 11 * MINUTE },
  { id: 'f7', petName: 'Churro', petId: 1, aliveMs: 8 * MINUTE },
  { id: 'f8', petName: 'Bolita', petId: 2, aliveMs: 6 * MINUTE },
  { id: 'f9', petName: 'Dot', petId: 3, aliveMs: 4 * MINUTE },
  { id: 'f10', petName: 'Paseo', petId: 4, aliveMs: 2 * MINUTE },
];

/** Datos falsos con un retraso para ver el estado de carga. `getMine` agrega la mascota del usuario. */
export function createMockRanking(getMine: () => RankingEntry | null, delayMs = 600): RankingSource {
  return {
    async getTop() {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      const mine = getMine();
      const entries: RankingEntry[] = FAKE.map((entry) => ({ ...entry, isMine: false }));
      if (mine) entries.push({ ...mine, isMine: true });
      return sortRanking(entries);
    },
  };
}
