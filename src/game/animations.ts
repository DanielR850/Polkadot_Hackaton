import type { NeedKey } from './types.ts';

export type PetAnim = 'idle' | 'eat' | 'play' | 'sleep' | 'bath' | 'sad' | 'dead';

export interface AnimInput {
  dead: boolean;
  sleeping: boolean;
  bathing: boolean;
  /** Animación breve en curso (comer o jugar) y hasta cuándo dura. */
  action: { anim: 'eat' | 'play'; until: number } | null;
  low: readonly NeedKey[];
  now: number;
}

/** Elige la animación de la mascota. El orden define la prioridad. */
export function pickAnimation(input: AnimInput): PetAnim {
  if (input.dead) return 'dead';
  if (input.sleeping) return 'sleep';
  if (input.bathing) return 'bath';
  if (input.action && input.now < input.action.until) return input.action.anim;
  if (input.low.length > 0) return 'sad';
  return 'idle';
}
