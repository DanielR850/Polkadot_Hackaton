// Reglas puras de la mascota. Cada función recibe `now` y devuelve un estado nuevo; no muta nada.
// El valor actual de cada necesidad se calcula desde su base y el tiempo transcurrido, así que el
// juego funciona igual si la app estuvo cerrada.
import { DEFAULT_CONFIG } from './config.ts';
import { findItem } from './catalog.ts';
import type { GameConfig, NeedKey, Needs, PetId, PetState, Stage, Stats } from './types.ts';

export const NEED_KEYS: readonly NeedKey[] = ['hunger', 'thirst', 'energy', 'happiness', 'cleanliness'];
export const NAME_MAX_LENGTH = 16;
/** Límite del contrato PolkaPets (NOMBRE_MAX): 24 bytes UTF-8. La ñ y los acentos ocupan 2. */
export const NAME_MAX_BYTES = 24;
const MINUTE = 60_000;
const START_VALUE = 80;
const STAGE_ORDER: readonly Stage[] = ['baby', 'teen', 'adult'];

export const clamp = (n: number) => Math.max(0, Math.min(100, n));

export type NameResult = { ok: true; value: string } | { ok: false; error: string };

export function validateName(raw: string): NameResult {
  const value = raw.trim().replace(/\s+/g, ' ');
  if (value.length === 0) return { ok: false, error: 'Escribe un nombre.' };
  if ([...value].length > NAME_MAX_LENGTH) return { ok: false, error: `Máximo ${NAME_MAX_LENGTH} caracteres.` };
  if (new TextEncoder().encode(value).length > NAME_MAX_BYTES) return { ok: false, error: 'Muy largo: la ñ, los acentos y los emojis cuentan doble o más.' };
  return { ok: true, value };
}

export function createPet(petId: PetId, name: string, now: number): PetState {
  const needs = Object.fromEntries(NEED_KEYS.map((key) => [key, START_VALUE])) as Needs;
  return { version: 2, petId, name, bornAt: now, updatedAt: now, needs, sleeping: false, diedAt: null };
}

export function computeNeeds(state: PetState, now: number, config: GameConfig = DEFAULT_CONFIG): Needs {
  const until = state.diedAt ?? now;
  const minutes = Math.max(0, until - state.updatedAt) / MINUTE;
  const factor = state.sleeping ? config.sleepDecayFactor : 1;
  const needs = {} as Needs;
  for (const key of NEED_KEYS) {
    const delta = state.sleeping && key === 'energy'
      ? config.sleepEnergyPerMinute * minutes
      : -config.decayPerMinute[key] * factor * minutes;
    needs[key] = clamp(state.needs[key] + delta);
  }
  return needs;
}

export function computeStats(state: PetState, now: number, config: GameConfig = DEFAULT_CONFIG): Stats {
  const needs = computeNeeds(state, now, config);
  const health = NEED_KEYS.reduce((sum, key) => sum + needs[key], 0) / NEED_KEYS.length;
  return { ...needs, health };
}

export function ageMs(state: PetState, now: number): number {
  return Math.max(0, (state.diedAt ?? now) - state.bornAt);
}

export function computeStage(state: PetState, now: number, config: GameConfig = DEFAULT_CONFIG): Stage {
  const age = ageMs(state, now);
  if (age >= config.adultAtMs) return 'adult';
  if (age >= config.teenAtMs) return 'teen';
  return 'baby';
}

/**
 * Muere cuando la vida llega a 0 o cuando el hambre y la sed llegan a 0 a la vez. La segunda regla
 * evita que dormir la vuelva inmortal: dormida, la energía sube y la vida (promedio) nunca llegaría a 0.
 */
export function isDead(state: PetState, now: number, config: GameConfig = DEFAULT_CONFIG): boolean {
  if (state.diedAt !== null) return true;
  const stats = computeStats(state, now, config);
  return stats.health <= 0 || (stats.hunger <= 0 && stats.thirst <= 0);
}

/**
 * Primer instante (ms) en que la mascota ya está muerta, buscado entre el último cuidado y `now`.
 * Si la app estuvo cerrada, la muerte ocurrió antes de abrirla: así la duración no se infla.
 * Búsqueda binaria con precisión de 1 s.
 */
export function deathTime(state: PetState, now: number, config: GameConfig = DEFAULT_CONFIG): number {
  let lo = state.updatedAt;
  let hi = now;
  if (isDead({ ...state, diedAt: null }, lo, config)) return lo;
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (isDead({ ...state, diedAt: null }, mid, config)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Guarda la muerte en el estado la primera vez que se detecta, con el momento en que ocurrió. */
export function markDeadIfNeeded(state: PetState, now: number, config: GameConfig = DEFAULT_CONFIG): PetState {
  if (state.diedAt !== null || !isDead(state, now, config)) return state;
  const at = deathTime(state, now, config);
  return { ...state, needs: computeNeeds(state, at, config), updatedAt: at, diedAt: at };
}

export function lowNeeds(stats: Stats, config: GameConfig = DEFAULT_CONFIG): NeedKey[] {
  return NEED_KEYS.filter((key) => stats[key] < config.lowThreshold);
}

/** Lleva las necesidades al valor actual. Toda acción lo hace antes de aplicar su efecto. */
function settle(state: PetState, now: number, config: GameConfig): PetState {
  return { ...state, needs: computeNeeds(state, now, config), updatedAt: now };
}

function applyEffects(state: PetState, effects: Partial<Needs>): PetState {
  const needs = { ...state.needs };
  for (const key of NEED_KEYS) needs[key] = clamp(needs[key] + (effects[key] ?? 0));
  return { ...state, needs };
}

/** Acción con efecto en las necesidades. Muerta o dormida no hace nada. */
function careAction(state: PetState, now: number, config: GameConfig, effects: Partial<Needs>): PetState {
  if (isDead(state, now, config) || state.sleeping) return state;
  return applyEffects(settle(state, now, config), effects);
}

export function feed(state: PetState, itemId: string, now: number, config: GameConfig = DEFAULT_CONFIG): PetState {
  const item = findItem(itemId);
  if (!item) return state;
  return careAction(state, now, config, item.effects);
}

export function play(state: PetState, now: number, config: GameConfig = DEFAULT_CONFIG): PetState {
  return careAction(state, now, config, { happiness: 20, energy: -12, cleanliness: -5, thirst: -5 });
}

/** `scrubPercent` (0–100) es cuánto se frotó en la escena del baño. Se aplica una sola vez al salir. */
export function bathe(state: PetState, scrubPercent: number, now: number, config: GameConfig = DEFAULT_CONFIG): PetState {
  const percent = clamp(scrubPercent);
  if (percent === 0) return state;
  return careAction(state, now, config, {
    cleanliness: (config.bathMaxGain * percent) / 100,
    happiness: percent >= 50 ? 5 : 0,
  });
}

export function sleep(state: PetState, now: number, config: GameConfig = DEFAULT_CONFIG): PetState {
  if (isDead(state, now, config) || state.sleeping) return state;
  return { ...settle(state, now, config), sleeping: true };
}

export function wake(state: PetState, now: number, config: GameConfig = DEFAULT_CONFIG): PetState {
  if (isDead(state, now, config) || !state.sleeping) return state;
  return { ...settle(state, now, config), sleeping: false };
}

export function rename(state: PetState, rawName: string, now: number, config: GameConfig = DEFAULT_CONFIG): PetState {
  const result = validateName(rawName);
  if (!result.ok || isDead(state, now, config)) return state;
  return { ...state, name: result.value };
}

/** Devuelve la etapa nueva si avanzó entre dos lecturas; null si no cambió. */
export function detectStageChange(previous: Stage, next: Stage): Stage | null {
  return STAGE_ORDER.indexOf(next) > STAGE_ORDER.indexOf(previous) ? next : null;
}
