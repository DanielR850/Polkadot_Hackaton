// Textos y niveles de la interfaz. Funciones puras (se prueban sin DOM).
import type { NeedKey, Stage } from '../game/types.ts';

export type BarLevel = 'good' | 'warn' | 'bad';

/** Verde por encima de 60, amarillo de 30 a 60, rojo por debajo de 30. */
export function barLevel(value: number): BarLevel {
  if (value > 60) return 'good';
  if (value >= 30) return 'warn';
  return 'bad';
}

export const STAGE_LABEL: Record<Stage, string> = { baby: 'Bebé', teen: 'Adolescente', adult: 'Adulto' };

export const BAR_INFO: ReadonlyArray<{ key: NeedKey | 'health'; label: string; icon: string }> = [
  { key: 'health', label: 'Vida', icon: '❤️' },
  { key: 'hunger', label: 'Hambre', icon: '🍓' },
  { key: 'thirst', label: 'Sed', icon: '💧' },
  { key: 'energy', label: 'Energía', icon: '⚡' },
  { key: 'happiness', label: 'Felicidad', icon: '♡' },
  { key: 'cleanliness', label: 'Limpieza', icon: '🫧' },
];

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min ${seconds} s`;
  return `${seconds} s`;
}
