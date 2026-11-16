// Historial de mascotas ("Mis animales"). Lógica pura con guardado local; no importa Phaser ni Polkadot.
//
// Cada vez que una mascota se reemplaza (Jugar de nuevo, Elegir otra mascota) queda un registro con
// lo que fue: especie, color, modo, dificultad, cuánto vivió y su NFT si lo tuvo.
import type { LifeHours, PetId } from './types.ts';

export interface PetRecord {
  id: string;
  name: string;
  petId: PetId;
  variant: string | null;
  lifeHours?: LifeHours;
  peaceful: boolean;
  bornAt: number;
  /** Cuándo terminó la partida (se reemplazó o murió). */
  endedAt: number;
  /** null si no murió (se reemplazó en vida, por ejemplo en modo Pacífico). */
  diedAt: number | null;
  aliveMs: number;
  tokenId?: string;
}

export const HISTORY_MAX = 60;
const KEY = 'tamagotchi-polkadot-history-v1';
let memory: string | null = null;

const isRecord = (r: unknown): r is PetRecord => {
  const x = r as Partial<PetRecord> | null;
  return !!x && typeof x.id === 'string' && typeof x.name === 'string' && typeof x.petId === 'number'
    && typeof x.bornAt === 'number' && typeof x.endedAt === 'number' && typeof x.aliveMs === 'number';
};

export function loadHistory(): PetRecord[] {
  let raw = memory;
  try { raw = localStorage.getItem(KEY); } catch { /* sin localStorage */ }
  try {
    const d = raw ? JSON.parse(raw) : [];
    return Array.isArray(d) ? d.filter(isRecord) : [];
  } catch {
    return [];
  }
}

export function saveHistory(list: readonly PetRecord[]): void {
  memory = JSON.stringify(list.slice(0, HISTORY_MAX));
  try { localStorage.setItem(KEY, memory); } catch { /* se queda en memoria */ }
}

/** Agrega un registro al principio (el más reciente primero) sin duplicar por id. */
export function addRecord(list: readonly PetRecord[], record: PetRecord): PetRecord[] {
  return [record, ...list.filter((r) => r.id !== record.id)].slice(0, HISTORY_MAX);
}

/** Resumen para la ventana: cuántas tuvo, la que más vivió y por especie. */
export function summarize(list: readonly PetRecord[]): { total: number; best: PetRecord | null; bySpecies: Record<number, number> } {
  const bySpecies: Record<number, number> = {};
  let best: PetRecord | null = null;
  for (const r of list) {
    bySpecies[r.petId] = (bySpecies[r.petId] ?? 0) + 1;
    if (!best || r.aliveMs > best.aliveMs) best = r;
  }
  return { total: list.length, best, bySpecies };
}
