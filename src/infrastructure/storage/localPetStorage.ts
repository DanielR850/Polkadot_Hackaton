import type { PetState } from '../../domain/pet/petState';
import type { PetStorage } from './petStorage';

const STORAGE_KEY = 'tamagotchi-polkadot-pet-v1';
const numericFields = ['hunger', 'energy', 'cleanliness', 'happiness', 'day', 'lastDay'] as const;

/** Local browser adapter for the playable prototype. */
export class LocalPetStorage implements PetStorage {
  async load(): Promise<Partial<PetState> | undefined> {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return undefined;

      const value: unknown = JSON.parse(raw);
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;

      const saved: Partial<PetState> = {};
      const record = value as Record<string, unknown>;
      for (const field of numericFields) {
        if (typeof record[field] === 'number' && Number.isFinite(record[field])) {
          saved[field] = record[field];
        }
      }
      return saved;
    } catch {
      return undefined;
    }
  }

  async save(state: PetState): Promise<void> {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Keep the current session playable when browser storage is unavailable.
    }
  }
}
