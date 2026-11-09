// Reglas de los minijuegos. Lógica pura: recompensas, cuándo se puede jugar y dificultad.

export type MiniGameId = 'catch' | 'pong';

export interface MiniGameResult {
  game: MiniGameId;
  /** Puntos de la partida. */
  score: number;
  /** Pesitos ganados en la partida. */
  coins: number;
}

export const MINI_GAMES: ReadonlyArray<{ id: MiniGameId; name: string; icon: string; description: string }> = [
  { id: 'catch', name: 'Atrapa la fruta', icon: '🍓', description: '25 segundos. Atrapa frutas y pesitos; esquiva los chiles.' },
  { id: 'pong', name: 'Ping pong', icon: '🏓', description: 'Aguanta la pelota en juego: +1 🪙 cada 5 s. Pierdes con 3 fallos.' },
];

/** Duración de Atrapa la fruta. */
export const CATCH_SECONDS = 25;
/** Fallos permitidos en ping pong y su tiempo máximo. */
export const PONG_LIVES = 3;
export const PONG_MAX_SECONDS = 90;
/** En ping pong los pesitos se ganan por tiempo con la pelota en juego: +1 cada 5 s (hasta 18). */
export const PONG_COIN_EVERY_MS = 5_000;

/** Espera entre partidas cobradas, para no subir la felicidad sin parar. */
export const PLAY_COOLDOWN_MS = 2 * 60_000;
/** Debajo de esta energía está muy cansada para jugar. */
export const MIN_ENERGY_TO_PLAY = 15;
/** Lo que cuesta jugar (igual que el botón Jugar de antes). */
export const PLAY_COST = { energy: -12, cleanliness: -5, thirst: -5 } as const;

/** Felicidad que da una partida: de 5 a 30 según el puntaje. */
export function happinessFor(result: MiniGameResult): number {
  const raw = result.game === 'catch' ? 5 + result.score : 5 + result.score * 4;
  return Math.max(5, Math.min(30, Math.round(raw)));
}

export type CanPlay = { ok: true } | { ok: false; reason: string };

export function canPlay(input: {
  dead: boolean; asleep: boolean; energy: number; lastPlayAt: number; now: number; cooldownMs: number;
}): CanPlay {
  if (input.dead) return { ok: false, reason: 'Tu mascota ya no puede jugar.' };
  if (input.asleep) return { ok: false, reason: 'Está dormida. Despiértala para jugar.' };
  if (input.energy < MIN_ENERGY_TO_PLAY) return { ok: false, reason: 'Está muy cansada para jugar. Mándala a dormir primero.' };
  const wait = input.lastPlayAt + input.cooldownMs - input.now;
  if (wait > 0) return { ok: false, reason: `Todavía está agitada. Podrá jugar otra vez en ${Math.ceil(wait / 1000)} s.` };
  return { ok: true };
}

/**
 * Qué tan bien juega la mascota al ping pong (0.35–0.9): mejor si está feliz y con energía.
 * Más alto = devuelve más pelotas y te cuesta más ganarle puntos.
 */
export function pongSkill(happiness: number, energy: number): number {
  return 0.35 + 0.55 * Math.max(0, Math.min(1, (happiness + energy) / 200));
}
