// Colección de comida y drops. Lógica pura: no importa Phaser, DOM ni Polkadot.
//
// La comida especial se compra con pesitos 🪙 o cae como drop por tiempo de vida, y se guarda en la
// despensa de la mascota hasta usarla. Con NFT (PolkaPetsItems v2) cada comida es un NFT ligado a la
// mascota: usarla lo quema y cura a la mascota en la cadena. Sin NFT todo vive en el dispositivo.
// Los ids de artículo (`articleId`) deben coincidir con `_comida(...)` en PolkaPetsItems.sol.
import type { Needs } from './types.ts';

/** Vida: cura la salud (en la cadena suma vida). Saciedad: llena las necesidades. */
export type FoodUtility = 'life' | 'satiety';

export interface SpecialFood {
  id: string;
  articleId: number;
  name: string;
  icon: string;
  /** Precio en pesitos; 0 si solo se consigue como drop. */
  price: number;
  utility: FoodUtility;
  value: number;
  /** true = no se vende: solo cae como drop. */
  dropOnly?: boolean;
}

export const FOOD_CATALOG: readonly SpecialFood[] = [
  { id: 'food:tamal', articleId: 25, name: 'Tamal', icon: '🫔', price: 30, utility: 'life', value: 20 },
  { id: 'food:pan-de-muerto', articleId: 26, name: 'Pan de muerto', icon: '🍞', price: 25, utility: 'satiety', value: 25 },
  { id: 'food:elote', articleId: 27, name: 'Elote', icon: '🌽', price: 20, utility: 'satiety', value: 15 },
  { id: 'food:jamaica', articleId: 28, name: 'Agua de jamaica', icon: '🧃', price: 15, utility: 'satiety', value: 20 },
  { id: 'food:chocolate', articleId: 29, name: 'Chocolate caliente', icon: '☕', price: 45, utility: 'life', value: 30 },
  { id: 'food:mole', articleId: 30, name: 'Mole de la abuela', icon: '🍛', price: 0, utility: 'life', value: 50, dropOnly: true },
  { id: 'food:elixir', articleId: 31, name: 'Elixir de ajolote', icon: '🧪', price: 0, utility: 'satiety', value: 60, dropOnly: true },
];

export const findFood = (id: string) => FOOD_CATALOG.find((f) => f.id === id);
export const findFoodByArticle = (articleId: number) => FOOD_CATALOG.find((f) => f.articleId === articleId);

/** Texto de la utilidad: "+20 vida" o "+25 a todo". */
export function describeFood(food: SpecialFood): string {
  return food.utility === 'life' ? `+${food.value} vida` : `+${food.value} a todo`;
}

/**
 * Efecto en el juego local. La vida del juego es el promedio de las necesidades, así que "Vida"
 * sube las cinco a la mitad de su valor y "Saciedad" sube hambre, sed y energía a su valor completo.
 * En la cadena lo aplica el contrato (PolkaPets.curar).
 */
export function foodEffects(food: SpecialFood): Partial<Needs> {
  if (food.utility === 'life') {
    const v = Math.round(food.value / 2);
    return { hunger: v, thirst: v, energy: v, happiness: v, cleanliness: v };
  }
  return { hunger: food.value, thirst: food.value, energy: Math.round(food.value / 2) };
}

/* ----------------------------------------------------------------- drops */

/** Cada cuánto tiempo de vida cae un drop (igual que `intervaloDrop` del contrato). */
export const DROP_INTERVAL_MS = 30 * 60_000;

/** Drops que se pueden reclamar: uno por cada intervalo vivido, menos los ya reclamados. */
export function dropsAvailable(ageMs: number, taken: number, intervalMs = DROP_INTERVAL_MS): number {
  if (!(ageMs > 0) || !(intervalMs > 0)) return 0;
  return Math.max(0, Math.floor(ageMs / intervalMs) - Math.max(0, taken));
}

/** Comida de un drop local. `random` en [0, 1) (Math.random en el juego; fijo en las pruebas). */
export function pickDrop(random: number): SpecialFood {
  const i = Math.min(FOOD_CATALOG.length - 1, Math.max(0, Math.floor(random * FOOD_CATALOG.length)));
  return FOOD_CATALOG[i];
}

/* ------------------------------------------- despensa (en el dispositivo) */

/** Una comida guardada. `tokenId` existe si es un NFT de PolkaPetsItems. */
export interface PantryItem { uid: string; foodId: string; tokenId?: string }

export interface PantryState { items: PantryItem[]; dropsTaken: number }

const KEY = 'tamagotchi-polkadot-pantry-v1';
let memory: string | null = null;
const EMPTY: PantryState = { items: [], dropsTaken: 0 };

export function loadPantry(): PantryState {
  let raw = memory;
  try { raw = localStorage.getItem(KEY); } catch { /* sin localStorage */ }
  try {
    const d = raw ? (JSON.parse(raw) as Partial<PantryState>) : null;
    if (!d) return { items: [], dropsTaken: 0 };
    const items = Array.isArray(d.items)
      ? d.items.filter((i): i is PantryItem => !!i && typeof i.uid === 'string' && typeof i.foodId === 'string' && !!findFood(i.foodId))
      : [];
    const dropsTaken = typeof d.dropsTaken === 'number' && Number.isFinite(d.dropsTaken) && d.dropsTaken >= 0 ? Math.floor(d.dropsTaken) : 0;
    return { items, dropsTaken };
  } catch {
    return { ...EMPTY, items: [] };
  }
}

export function savePantry(state: PantryState): void {
  memory = JSON.stringify(state);
  try { localStorage.setItem(KEY, memory); } catch { /* se queda en memoria */ }
}

/** Nueva mascota: la despensa y los drops son de la anterior. */
export function clearPantry(): void {
  savePantry({ items: [], dropsTaken: 0 });
}

export const addToPantry = (state: PantryState, item: PantryItem): PantryState => ({ ...state, items: [...state.items, item] });
export const removeFromPantry = (state: PantryState, uid: string): PantryState => ({ ...state, items: state.items.filter((i) => i.uid !== uid) });
