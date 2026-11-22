// Cálculos del baño: solo pantalla. El resultado se aplica una vez al salir con `bathe()`.

export interface Circle { x: number; y: number; r: number }
export interface Ellipse { x: number; y: number; rx: number; ry: number }

/** Progreso por píxel frotado y máximo por segundo, para que agitar muy rápido no lo llene al instante. */
export const SCRUB_PER_PIXEL = 0.12;
export const SCRUB_MAX_PER_SECOND = 35;

export function spongeTouchesPet(sponge: Circle, pet: Ellipse): boolean {
  const dx = (sponge.x - pet.x) / (pet.rx + sponge.r);
  const dy = (sponge.y - pet.y) / (pet.ry + sponge.r);
  return dx * dx + dy * dy <= 1;
}

/** Suma progreso (0–100) solo si la esponja se mueve encima de la mascota. */
export function scrubProgress(current: number, movedPx: number, touching: boolean, dtMs: number): number {
  if (!touching || movedPx <= 0 || dtMs <= 0) return current;
  const gain = Math.min(movedPx * SCRUB_PER_PIXEL, (SCRUB_MAX_PER_SECOND * dtMs) / 1000);
  return Math.min(100, current + gain);
}
