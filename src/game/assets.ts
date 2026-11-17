import type { PetAnim } from './animations.ts';
import type { PetId, Stage } from './types.ts';

// Contrato de assets entre la interfaz y el equipo de arte. Ver docs/ASSETS.md.
// Si una entrada no existe o su archivo no carga, la escena dibuja el marcador temporal.

export interface SpriteSheet {
  petId: PetId;
  stage: Stage;
  anim: PetAnim;
  /** Ruta relativa a `public/assets/`, por ejemplo `characters/axolotl-baby-idle.png`. */
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

/** Cada especie tiene arte de las tres edades; los estados usan cuadros o movimiento Phaser. */
export const SPRITES: SpriteSheet[] = [
  { petId: 0, stage: 'baby', anim: 'idle', file: 'pets/axolotl/animations.png', frameWidth: 356, frameHeight: 276, fps: 4, firstFrame: 0, lastFrame: 3 },
  { petId: 0, stage: 'baby', anim: 'play', file: 'pets/axolotl/animations.png', frameWidth: 356, frameHeight: 276, fps: 7, firstFrame: 4, lastFrame: 7 },
  { petId: 0, stage: 'baby', anim: 'eat', file: 'pets/axolotl/animations.png', frameWidth: 356, frameHeight: 276, fps: 6, firstFrame: 8, lastFrame: 11 },
  { petId: 0, stage: 'baby', anim: 'sleep', file: 'pets/axolotl/animations.png', frameWidth: 356, frameHeight: 276, fps: 3, firstFrame: 12, lastFrame: 15 },
  { petId: 0, stage: 'teen', anim: 'idle', file: 'pets/axolotl/teen.png', frameWidth: 1254, frameHeight: 1254, fps: 1 },
  { petId: 0, stage: 'adult', anim: 'idle', file: 'pets/axolotl/adult.png', frameWidth: 1254, frameHeight: 1254, fps: 1 },
  ...(['wolf', 'bear', 'opossum', 'manatee'] as const).flatMap((slug, index) =>
    (['baby', 'teen', 'adult'] as const).map((stage) => ({
      petId: index + 1, stage, anim: 'idle' as const,
      file: `pets/${slug}/${stage === 'baby' ? 'idle' : stage}.png`,
      frameWidth: 1254, frameHeight: 1254, fps: 1,
    }))),
];

/** La selección usa las mismas imágenes que la escena. */
export const portraitUrl = (slug: string) => slug === 'axolotl'
  ? assetUrl('pets/axolotl/teen.png') : assetUrl(`pets/${slug}/idle.png`);

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
export const assetUrl = (file: string) => `assets/${file}`;
export const backgroundUrl = (file: string) => `assets/backgrounds/${file}`;
