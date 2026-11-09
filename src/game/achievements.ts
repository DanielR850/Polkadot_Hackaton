// Logros (trofeos) de una mascota. Lógica pura: no importa Phaser, DOM ni Polkadot.
//
// Cada logro se gana por tiempo vivido y/o por objetos comprados para esa mascota. Pertenecen a la
// mascota: al empezar otra, empieza sin ninguno. Con un NFT de mascota y el contrato de objetos,
// reclamar un logro es una firma que crea un NFT ligado a ella; el contrato vuelve a comprobar el
// tiempo y los objetos (mismos números que `_logro(...)` en PolkaPetsItems.sol).

export interface AchievementDef {
  /** Id del logro en el contrato PolkaPetsItems. */
  id: number;
  name: string;
  icon: string;
  /** Texto de la condición, para mostrar. */
  description: string;
  /** Segundos vividos desde la adopción. */
  minSeconds: number;
  /** Objetos comprados para esta mascota. */
  minItems: number;
  /** Pesitos 🪙 que da al reclamarlo (los acredita el juego, son locales). */
  coins: number;
  /** Objeto exclusivo (id de la tienda) que se entrega junto al trofeo; el contrato lo mintea. */
  rewardItem?: string;
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 1, name: 'Primeros pasos', icon: '🐣', description: 'Cuidarla durante 10 minutos.', minSeconds: 10 * MINUTE, minItems: 0, coins: 10 },
  { id: 2, name: 'Adolescente', icon: '🌱', description: 'Llegar a la etapa adolescente (1 hora de vida).', minSeconds: HOUR, minItems: 0, coins: 20 },
  { id: 3, name: 'Adulta', icon: '🌳', description: 'Llegar a la etapa adulta (4 horas de vida).', minSeconds: 4 * HOUR, minItems: 0, coins: 40, rewardItem: 'shop:medalla' },
  { id: 4, name: 'Resistente', icon: '💪', description: 'Vivir 8 horas.', minSeconds: 8 * HOUR, minItems: 0, coins: 60 },
  { id: 5, name: 'Un día completo', icon: '📅', description: 'Vivir 24 horas.', minSeconds: DAY, minItems: 0, coins: 100, rewardItem: 'shop:estrella' },
  { id: 6, name: 'Una semana', icon: '🏆', description: 'Vivir 7 días.', minSeconds: 7 * DAY, minItems: 0, coins: 300, rewardItem: 'shop:cinta' },
  { id: 7, name: 'Coleccionista', icon: '🎁', description: 'Tener 3 objetos en su colección.', minSeconds: 0, minItems: 3, coins: 30 },
  { id: 8, name: 'Gran colección', icon: '🏺', description: 'Tener 8 objetos en su colección.', minSeconds: 0, minItems: 8, coins: 100, rewardItem: 'shop:amuleto' },
  { id: 9, name: 'Casa llena', icon: '🏠', description: 'Tener 15 objetos en su colección.', minSeconds: 0, minItems: 15, coins: 200 },
];

/** locked: aún no se alcanza · available: alcanzado, falta reclamarlo · claimed: ya es suyo. */
export type AchievementState = 'locked' | 'available' | 'claimed';

export interface Progress {
  /** Tiempo vivido en ms (el reloj real, sin acelerar con `?speed=`). */
  ageMs: number;
  /** Objetos comprados para esta mascota. */
  items: number;
}

export function isReached(def: AchievementDef, progress: Progress): boolean {
  return progress.ageMs / 1000 >= def.minSeconds && progress.items >= def.minItems;
}

export function achievementState(def: AchievementDef, claimed: readonly number[], progress: Progress): AchievementState {
  if (claimed.includes(def.id)) return 'claimed';
  return isReached(def, progress) ? 'available' : 'locked';
}

/** Logros alcanzados que todavía no se reclaman. */
export function availableAchievements(claimed: readonly number[], progress: Progress): AchievementDef[] {
  return ACHIEVEMENTS.filter((def) => achievementState(def, claimed, progress) === 'available');
}

/* ------------------------------------------- reclamados (en el dispositivo) */

const KEY = 'tamagotchi-polkadot-achievements-v1';
let memory: string | null = null;

export function loadClaimed(): number[] {
  let raw = memory;
  try { raw = localStorage.getItem(KEY); } catch { /* sin localStorage */ }
  try {
    const d = raw ? JSON.parse(raw) : [];
    return Array.isArray(d) ? d.filter((x): x is number => typeof x === 'number' && ACHIEVEMENTS.some((a) => a.id === x)) : [];
  } catch {
    return [];
  }
}

export function saveClaimed(ids: readonly number[]): void {
  memory = JSON.stringify([...new Set(ids)]);
  try { localStorage.setItem(KEY, memory); } catch { /* se queda en memoria */ }
}

/** Nueva mascota: los trofeos son de la anterior y no se heredan. */
export function clearClaimed(): void {
  saveClaimed([]);
}
