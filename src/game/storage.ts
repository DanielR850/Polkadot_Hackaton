import { isPetId } from './catalog.ts';
import { NEED_KEYS } from './petState.ts';
import type { PetState } from './types.ts';

// Guardado local. Dentro del Host `localStorage` no está verificado, así que todo va en try/catch
// con respaldo en memoria. Clave nueva (v2) porque el formato cambió respecto al prototipo.
export const PET_STORAGE_KEY = 'tamagotchi-polkadot-pet-v2';
let memory: string | null = null;

export function parsePetState(raw: string | null): PetState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<PetState>;
    const needsOk = data.needs && NEED_KEYS.every((key) => typeof data.needs?.[key] === 'number');
    if (data.version !== 2 || !isPetId(data.petId) || typeof data.name !== 'string' || !needsOk) return null;
    if (typeof data.bornAt !== 'number' || typeof data.updatedAt !== 'number') return null;
    return {
      version: 2,
      petId: data.petId,
      name: data.name,
      bornAt: data.bornAt,
      updatedAt: data.updatedAt,
      needs: { ...data.needs! },
      sleeping: data.sleeping === true,
      diedAt: typeof data.diedAt === 'number' ? data.diedAt : null,
    };
  } catch {
    return null;
  }
}

export function loadPet(): PetState | null {
  let raw = memory;
  try { raw = localStorage.getItem(PET_STORAGE_KEY); } catch { /* sin localStorage */ }
  return parsePetState(raw);
}

export function savePet(state: PetState | null): void {
  memory = state ? JSON.stringify(state) : null;
  try {
    if (memory) localStorage.setItem(PET_STORAGE_KEY, memory);
    else localStorage.removeItem(PET_STORAGE_KEY);
  } catch { /* se queda en memoria */ }
}
