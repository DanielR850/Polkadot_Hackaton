import type { PetAnim } from './animations.ts';
import type { PetId, Stage } from './types.ts';

// Contrato de assets entre la interfaz y el equipo de arte. Ver docs/ASSETS.md.
// Si una entrada no existe o su archivo no carga, la escena dibuja el marcador temporal.

export interface SpriteSheet {
  petId: PetId;
  stage: Stage;
  anim: PetAnim;
  /** Archivo dentro de `public/assets/characters/`, por ejemplo `axolotl-baby-idle.png`. */
  file: string;
  frameWidth: number;
  frameHeight: number;
  /** Fotogramas por segundo; los fotogramas se leen en horizontal. */
  fps: number;
  /** Rango opcional para hojas con varias animaciones; índices en orden de lectura. */
  firstFrame?: number;
  lastFrame?: number;
  /** false para animaciones que se detienen en el último fotograma (por ejemplo `dead`). */
  loop?: boolean;
}

/** Assets disponibles. Las especies que aún no tienen arte usan el marcador vectorial. */
export const SPRITES: SpriteSheet[] = [
  { petId: 0, stage: 'baby', anim: 'idle', file: '../pets/axolotl/animations.png', frameWidth: 356, frameHeight: 276, fps: 4, firstFrame: 0, lastFrame: 3 },
  { petId: 0, stage: 'baby', anim: 'play', file: '../pets/axolotl/animations.png', frameWidth: 356, frameHeight: 276, fps: 7, firstFrame: 4, lastFrame: 7 },
  { petId: 0, stage: 'baby', anim: 'eat', file: '../pets/axolotl/animations.png', frameWidth: 356, frameHeight: 276, fps: 6, firstFrame: 8, lastFrame: 11 },
  { petId: 0, stage: 'baby', anim: 'sleep', file: '../pets/axolotl/animations.png', frameWidth: 356, frameHeight: 276, fps: 3, firstFrame: 12, lastFrame: 15 },
];

/** Retrato de la pantalla "Elige tu mascota": `public/assets/characters/<slug>-portrait.png`. */
export const portraitUrl = (slug: string) => characterUrl(`${slug}-portrait.png`);

/** Fondos opcionales en `public/assets/backgrounds/`; null = fondo dibujado. */
export const BACKGROUNDS: { room: string | null; bath: string | null } = {
  room: null, // 'room-day.webp'
  bath: null, // 'bathroom.webp'
};

export function spriteKey(petId: PetId, stage: Stage, anim: PetAnim): string {
  return `pet-${petId}-${stage}-${anim}`;
}

// Rutas relativas: el bundle se sirve desde un CID (vite `base: './'`).
export const characterUrl = (file: string) => `assets/characters/${file}`;
export const backgroundUrl = (file: string) => `assets/backgrounds/${file}`;
