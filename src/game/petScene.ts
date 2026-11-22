import Phaser from 'phaser';
import type { PetAnim } from './animations.ts';
import { assetUrl, BACKGROUNDS, backgroundUrl, spriteKey, SPRITES, type SpriteSheet } from './assets.ts';
import { findPet } from './catalog.ts';
import { scrubProgress, spongeTouchesPet } from './sponge.ts';
import type { PetId, Stage } from './types.ts';
import type { RoomDecor } from './inventory.ts';
import { ICON_SIZE, pixelIconCanvas } from '../ui/pixelArt.ts';
import { closeEyes, EYES } from './sleepFace.ts';
import { BALL_SECONDS, BALL_TARGET, type MiniGameResult } from './minigames/rules.ts';
import { buildCloth, CLOTH_SLOT, clothColor } from './clothes.ts';
import { bodyPoints, placeAccessory as placeOnBody, type Slot } from './bodyPoints.ts';
import { PIXEL_STYLE, toRealPixelArt } from './pixelStyle.ts';
import { findVariant, recolorPixels, SPECIES_RAMPS, variantOutline } from './variants.ts';
import { BLOCK, buildTopHat, colorOf, findPalette, HAT_SIZES, HEAD_ANCHORS, type HeadAnchor, type HeadWear, wearKey } from './wearables.ts';

/** Lugares de los muebles (en el piso) y adornos (en la pared). */
const FURNITURE_X = [104, 332, 446];
const DECOR_SPOTS = [{ x: 216, y: 92 }, { x: 300, y: 70 }];

/** Oscurece un color 0xRRGGBB (para las franjas y tablas). */
const darker = (c: number, f = 0.82) =>
  (Math.round(((c >> 16) & 255) * f) << 16) | (Math.round(((c >> 8) & 255) * f) << 8) | Math.round((c & 255) * f);

// Escena de la habitación. Solo dibuja y anima; las reglas viven en petState.ts.
// Si no hay sprite para la mascota, etapa y animación, dibuja el marcador temporal con formas.

export interface SceneView {
  petId: PetId;
  stage: Stage;
  anim: PetAnim;
  /** Variante de color (`variants.ts`); null o desconocida = colores originales. */
  variant?: string | null;
  /** Estilo de dibujo: la ilustración original o pasada a pixel art real (`pixelStyle.ts`). */
  style?: 'original' | 'pixel';
}

export interface PetSceneHandle {
  show(view: SceneView): void;
  /**
   * Rebote y un emoji que flota (jugar). Con `kind: 'eat'` el emoji es la comida: la mascota la
   * sostiene junto a la boca y le da mordidas, como los cuadros del ajolote bebé.
   */
  react(icon: string, kind?: 'eat' | 'play'): void;
  /** Reinicia el progreso del baño a 0. */
  resetBath(): void;
  /** Colores de pared de la habitación, para que combinen con el tema de la mascota. */
  setRoomColors(colors: RoomColors): void;
  /** Decoración del inventario: color de pared y piso, muebles en el piso y adornos en la pared. */
  setDecor(decor: RoomDecor): void;
  /**
   * Accesorio que lleva la mascota, o null. Si `wear` existe se dibuja como prenda de pixel art
   * ajustada a la cabeza de cada especie y edad; si no, el emoji sobre la cabeza.
   */
  setAccessory(icon: string | null, wear?: HeadWear | null, slot?: Slot): void;
  /** Ropa del cuerpo (poncho, paliacate, rebozo), o null. */
  setOutfit(wear: HeadWear | null): void;
  /**
   * "Atrapa la pelota" en la misma habitación: aparece una pelota, la mascota corre hacia ella y
   * hay que tocarla 5 veces en 12 s. Devuelve false si ahora no se puede (dormida, baño, etc.).
   */
  playInRoom(onEnd: (result: MiniGameResult) => void): boolean;
  /** ¿Hay una partida en la habitación? */
  isPlaying(): boolean;
  /** Al tocar a la mascota (acariciarla) fuera de una partida. */
  onPet(handler: () => void): void;
}

export interface RoomColors { wall: number; stripe: number }

/** Un paso de animación encadenada (sin `targets`: se aplica a la ilustración). */
type Step = Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'>;

const W = 520;
const H = 360;
/** La escena se dibuja a esta fracción de resolución y se amplía sin suavizado: píxeles grandes. */
const PIXEL = 0.4;
const ROOM_POS = { x: W / 2, y: 190 };
const BATH_POS = { x: W / 2, y: 205 };
const STAGE_SCALE: Record<Stage, number> = { baby: 0.8, teen: 0.95, adult: 1.1 };
const BODY = { rx: 61, ry: 56, offsetY: 8 };
const SPONGE_R = 22;
const DEAD_COLORS = { color: 0xb8b2bd, outline: 0x8a8490, belly: 0xd6d2da };
/** Paleta mexicana de la decoración (papel picado, talavera, sarape, piñata). */
const MX = {
  pink: 0xe4007c, orange: 0xff8c1a, yellow: 0xffd23f, green: 0x2e9e4f,
  turquoise: 0x00a6a6, blue: 0x1f4fa3, purple: 0x7b2d8e, red: 0xd7263d,
};
const INK = 0x302b43;

/**
 * Posición de la boca en cada ilustración, como fracción del cuadro (0–1), medida a ojo sobre
 * `public/assets/pets/<especie>/<etapa>.png`. Sirve para que la comida quede en la boca.
 * El ajolote bebé no aparece: su hoja ya trae los cuadros de comer con la fresa.
 */
const MOUTH: Record<number, Partial<Record<Stage, { x: number; y: number }>>> = {
  0: { teen: { x: 0.37, y: 0.48 }, adult: { x: 0.4, y: 0.46 } },
  1: { baby: { x: 0.72, y: 0.52 }, teen: { x: 0.75, y: 0.44 }, adult: { x: 0.81, y: 0.33 } },
  2: { baby: { x: 0.73, y: 0.52 }, teen: { x: 0.77, y: 0.42 }, adult: { x: 0.82, y: 0.31 } },
  3: { baby: { x: 0.79, y: 0.59 }, teen: { x: 0.81, y: 0.53 }, adult: { x: 0.83, y: 0.47 } },
  4: { baby: { x: 0.85, y: 0.53 }, teen: { x: 0.88, y: 0.49 }, adult: { x: 0.9, y: 0.45 } },
};
/** Color de las migajas según la comida. */
const CRUMB: Record<string, number[]> = {
  '🍎': [0xd7263d, 0xfff3d6], '🍓': [0xd7263d, 0x2e9e4f], '🍚': [0xffffff, 0xf2e8d0], '🍰': [0xffd9e6, 0xfff3d6],
  '💧': [0x7fc8f8, 0xd8f0ff], '🥛': [0xffffff, 0xeef4ff], '🧃': [0xff8c1a, 0xffd23f], '🍵': [0x9bc65a, 0xd8f0c0],
};
const DRINKS = new Set(['💧', '🥛', '🧃', '🍵']);
/** Mordidas dentro de la animación de comer (ms desde que empieza). Dura lo mismo que ACTION_MS. */
const BITES = [180, 520, 860];

/** La hoja del ajolote bebé trae un fondo granate en cada cuadro. Se elimina
 * al cargarla para que el personaje comparta la habitación con las demás edades. */
const AXOLOTL_SHEET_MARGIN = 2;
const AXOLOTL_SHEET_SPACING = 2;

/**
 * Limpia el fondo y reconstruye la hoja con separación transparente entre cuadros.
 * La separación evita que WebGL muestree las patas del cuadro vecino cuando el sprite se escala.
 */
function transparentAxolotlSheet(source: HTMLImageElement | HTMLCanvasElement, frameWidth: number, frameHeight: number): HTMLCanvasElement {
  const columns = Math.floor(source.width / frameWidth);
  const rows = Math.floor(source.height / frameHeight);
  const clean = document.createElement('canvas');
  clean.width = source.width;
  clean.height = source.height;
  const context = clean.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(source, 0, 0);
  const pixels = context.getImageData(0, 0, clean.width, clean.height);
  const data = pixels.data;
  const frameSize = frameWidth * frameHeight;
  const visited = new Uint8Array(frameSize);
  const queue = new Int32Array(frameSize);
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    visited.fill(0);
    let head = 0, tail = 0;
    const background = (local: number) => {
      const x = column * frameWidth + local % frameWidth;
      const y = row * frameHeight + Math.floor(local / frameWidth);
      const i = (y * clean.width + x) * 4;
      const red = data[i], green = data[i + 1], blue = data[i + 2];
      // El fondo es rojo oscuro con un gradiente; solo se borran sus píxeles conectados al borde.
      return data[i + 3] > 0 && red < 180 && green >= 12 && green < 105 && blue < 125 && red > green * 1.2;
    };
    const enqueue = (local: number) => {
      if (visited[local] || !background(local)) return;
      visited[local] = 1;
      queue[tail++] = local;
    };
    for (let x = 0; x < frameWidth; x++) { enqueue(x); enqueue((frameHeight - 1) * frameWidth + x); }
    for (let y = 0; y < frameHeight; y++) { enqueue(y * frameWidth); enqueue(y * frameWidth + frameWidth - 1); }
    while (head < tail) {
      const local = queue[head++];
      const x = local % frameWidth;
      const y = Math.floor(local / frameWidth);
      const i = ((row * frameHeight + y) * clean.width + column * frameWidth + x) * 4;
      data[i + 3] = 0;
      if (x > 0) enqueue(local - 1);
      if (x + 1 < frameWidth) enqueue(local + 1);
      if (y > 0) enqueue(local - frameWidth);
      if (y + 1 < frameHeight) enqueue(local + frameWidth);
    }
  }
  context.putImageData(pixels, 0, 0);

  const sheet = document.createElement('canvas');
  sheet.width = columns * frameWidth + (columns - 1) * AXOLOTL_SHEET_SPACING + AXOLOTL_SHEET_MARGIN * 2;
  sheet.height = rows * frameHeight + (rows - 1) * AXOLOTL_SHEET_SPACING + AXOLOTL_SHEET_MARGIN * 2;
  const sheetContext = sheet.getContext('2d')!;
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const x = AXOLOTL_SHEET_MARGIN + column * (frameWidth + AXOLOTL_SHEET_SPACING);
    const y = AXOLOTL_SHEET_MARGIN + row * (frameHeight + AXOLOTL_SHEET_SPACING);
    sheetContext.drawImage(clean, column * frameWidth, row * frameHeight, frameWidth, frameHeight, x, y, frameWidth, frameHeight);
  }
  return sheet;
}

function spriteSheetConfig(sheet: SpriteSheet): { frameWidth: number; frameHeight: number; margin?: number; spacing?: number } {
  return sheet.petId === 0 && sheet.stage === 'baby'
    ? { frameWidth: sheet.frameWidth, frameHeight: sheet.frameHeight, margin: AXOLOTL_SHEET_MARGIN, spacing: AXOLOTL_SHEET_SPACING }
    : { frameWidth: sheet.frameWidth, frameHeight: sheet.frameHeight };
}

export function createPetScene(parent: HTMLElement, onScrub: (progress: number) => void): PetSceneHandle {
  class RoomScene extends Phaser.Scene {
    private ready = false;
    private view: SceneView | null = null;
    private drawnKey = '';
    private petRoot!: Phaser.GameObjects.Container;
    private bobber!: Phaser.GameObjects.Container;
    private bob!: Phaser.Tweens.Tween;
    private placeholder!: Phaser.GameObjects.Container;
    private body!: Phaser.GameObjects.Ellipse;
    private belly!: Phaser.GameObjects.Ellipse;
    private ears: Phaser.GameObjects.Ellipse[] = [];
    private blush: Phaser.GameObjects.Ellipse[] = [];
    private face!: Phaser.GameObjects.Graphics;
    private sprite!: Phaser.GameObjects.Sprite;
    private roomLayer!: Phaser.GameObjects.Container;
    private bathLayer!: Phaser.GameObjects.Container;
    private tubFront!: Phaser.GameObjects.Graphics;
    private night!: Phaser.GameObjects.Rectangle;
    private zzz!: Phaser.GameObjects.Text;
    private sponge!: Phaser.GameObjects.Container;
    private scrub = { progress: 0, lastX: 0, lastY: 0, lastT: 0, lastBubble: 0 };
    private roomColors: RoomColors = { wall: 0xc9d3de, stripe: 0xbcc7d4 };
    private roomGfx: Phaser.GameObjects.Graphics | null = null;
    /** Comida que se va a comer en la próxima animación `eat` (la pone react). */
    private pendingFood = '🍓';
    /** Objetos y temporizadores de la animación de comer, para limpiarlos al cambiar de estado. */
    private eatObjects: Phaser.GameObjects.GameObject[] = [];
    private eatTimers: Phaser.Time.TimerEvent[] = [];
    private decor: RoomDecor = { wall: null, floor: null, furniture: [], decor: [] };
    private decorLayer!: Phaser.GameObjects.Container;
    private accessory!: Phaser.GameObjects.Image;
    /** Prenda de pixel art sobre la cabeza; sigue cada movimiento de la ilustración (update). */
    private hat!: Phaser.GameObjects.Image;
    /** Ropa del cuerpo; va entre la ilustración y el sombrero. */
    private outfit!: Phaser.GameObjects.Image;
    private outfitWear: HeadWear | null = null;
    private wear: HeadWear | null = null;
    /** Emoji del accesorio; se guarda aunque la escena aún no exista y se aplica en create(). */
    private accessoryIcon: string | null = null;
    /** Lugar del cuerpo del accesorio de ícono (cabeza, lado, ojos o cuello). */
    private accessorySlot: Slot = 'head';
    /** Ilustraciones recoloreadas: una por imagen original y variante (se generan una sola vez). */
    private recolored = new WeakMap<object, Map<string, HTMLCanvasElement>>();
    /** Última posición y escala aplicadas a la mascota (para no reasignarlas cada segundo). */
    private placeKey = '';
    private bobPace = 1;
    /** Hoja de la ilustración visible (para parpadear con los ojos cerrados por código). */
    private spriteKeyNow = '';
    /** Estado anterior: al salir del baño se sacude el agua. */
    private lastAnim: PetAnim | null = null;
    /** Escala base de la ilustración actual (la usan las reacciones al tocarla). */
    private spriteScale = 1;
    private lastTapAt = 0;
    private tapCount = 0;

    constructor() { super('room'); }

    preload() {
      this.load.on('loaderror', () => { /* sin el archivo se usa el marcador */ });
      for (const s of SPRITES) {
        this.load.spritesheet(spriteKey(s.petId, s.stage, s.anim), assetUrl(s.file), { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
      }
      if (BACKGROUNDS.room) this.load.image('bg-room', backgroundUrl(BACKGROUNDS.room));
      if (BACKGROUNDS.bath) this.load.image('bg-bath', backgroundUrl(BACKGROUNDS.bath));
    }

    create() {
      // El mundo sigue midiendo W×H; la cámara lo reduce al lienzo pequeño.
      this.cameras.main.setZoom(PIXEL).centerOn(W / 2, H / 2);
      const babySheet = SPRITES.find((s) => s.petId === 0 && s.stage === 'baby');
      if (babySheet) {
        const firstKey = spriteKey(0, 'baby', babySheet.anim);
        if (this.textures.exists(firstKey)) {
          const source = this.textures.get(firstKey).getSourceImage() as HTMLImageElement;
          const clean = transparentAxolotlSheet(source, babySheet.frameWidth, babySheet.frameHeight);
          for (const sheet of SPRITES.filter((s) => s.petId === 0 && s.stage === 'baby')) {
            const key = spriteKey(0, 'baby', sheet.anim);
            this.textures.remove(key);
            // Phaser admite canvas en tiempo de ejecución, aunque su tipo solo declara imágenes.
            this.textures.addSpriteSheet(key, clean as unknown as HTMLImageElement, spriteSheetConfig(sheet));
          }
        }
      }
      for (const s of SPRITES) {
        const key = spriteKey(s.petId, s.stage, s.anim);
        if (!this.textures.exists(key)) continue;
        this.anims.create({ key, frames: this.anims.generateFrameNumbers(key, {
          ...(s.firstFrame === undefined ? {} : { start: s.firstFrame }),
          ...(s.lastFrame === undefined ? {} : { end: s.lastFrame }),
        }), frameRate: s.fps, repeat: s.loop === false ? 0 : -1 });
      }

      this.roomLayer = this.add.container(0, 0, [
        this.textures.exists('bg-room') ? this.add.image(W / 2, H / 2, 'bg-room').setDisplaySize(W, H) : this.drawRoom(),
        this.drawMaracas(), this.drawGuitar(), this.drawToys(), this.drawPinata(),
      ]);
      this.decorLayer = this.add.container(0, 0);
      this.roomLayer.add(this.decorLayer);
      this.bathLayer = this.add.container(0, 0, [this.textures.exists('bg-bath') ? this.add.image(W / 2, H / 2, 'bg-bath').setDisplaySize(W, H) : this.drawBath()]).setVisible(false);

      this.body = this.add.ellipse(0, BODY.offsetY, BODY.rx * 2, BODY.ry * 2, 0xffffff);
      this.belly = this.add.ellipse(0, 28, 72, 56, 0xffffff);
      this.ears = [this.add.ellipse(-47, -42, 31, 43, 0xffffff).setAngle(-24), this.add.ellipse(47, -42, 31, 43, 0xffffff).setAngle(24)];
      this.blush = [this.add.ellipse(-40, 10, 16, 8, 0xe995a7, 0.75), this.add.ellipse(40, 10, 16, 8, 0xe995a7, 0.75)];
      this.face = this.add.graphics();
      this.placeholder = this.add.container(0, 0, [...this.ears, this.body, this.belly, ...this.blush, this.face]);
      this.sprite = this.add.sprite(0, 0, '__DEFAULT').setVisible(false);
      this.accessory = this.add.image(0, -80, '__DEFAULT').setOrigin(0.5, 1).setVisible(false);
      this.hat = this.add.image(0, 0, '__DEFAULT').setVisible(false);
      this.outfit = this.add.image(0, 0, '__DEFAULT').setVisible(false);
      this.bobber = this.add.container(0, 0, [this.placeholder, this.sprite, this.outfit, this.hat, this.accessory]);
      this.petRoot = this.add.container(ROOM_POS.x, ROOM_POS.y, [this.bobber]);
      this.bob = this.tweens.add({ targets: this.bobber, y: -7, duration: 950, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

      this.tubFront = this.drawTubFront().setVisible(false);
      this.night = this.add.rectangle(W / 2, H / 2, W, H, 0x1c1834, 0.5).setVisible(false);
      this.zzz = this.add.text(W / 2 - 10, 95, 'Z z z', { fontFamily: 'system-ui, sans-serif', fontSize: '28px', fontStyle: 'bold', color: '#fff6d8' }).setVisible(false);
      this.tweens.add({ targets: this.zzz, y: 80, alpha: 0.4, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.sponge = this.drawSponge().setVisible(false);

      this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.moveSponge(pointer.worldX, pointer.worldY));
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.moveSponge(pointer.worldX, pointer.worldY, true);
        this.touchPet(pointer.worldX, pointer.worldY);
      });

      this.ready = true;
      this.drawDecor();
      this.setAccessory(this.accessoryIcon, this.wear, this.accessorySlot);
      if (this.view) this.apply(this.view);
    }

    setDecor(decor: RoomDecor) {
      this.decor = decor;
      if (!this.ready) return;
      if (this.roomGfx) this.paintRoom(this.roomGfx.clear());
      this.drawDecor();
    }

    setAccessory(icon: string | null, wear: HeadWear | null = null, slot: Slot = 'head') {
      this.wear = wear;
      this.accessoryIcon = icon;
      this.accessorySlot = slot;
      // Antes de create() no hay objetos: se aplica al terminar de crear la escena.
      if (!this.ready) return;
      const key = !wear && icon ? this.iconTexture(icon) : null;
      if (key) this.accessory.setTexture(key);
      this.accessory.setVisible(key !== null);
      this.dressHat();
      this.followHead();
    }

    /** Ancla de la cabeza para la ilustración visible, o null si no hay ilustración (marcador). */
    private headAnchor(): HeadAnchor | null {
      if (!this.view || !this.sprite.visible) return null;
      return HEAD_ANCHORS[this.view.petId]?.[this.view.stage] ?? null;
    }

    /**
     * Elige la textura de la prenda para la mascota actual. Cada combinación de forma, tamaño,
     * paleta y contorno se genera una sola vez como pixel art (bloques de `block` píxeles de la
     * imagen original), así que se ve con el mismo tamaño de píxel que la ilustración.
     */
    /**
     * Viste una capa (cabeza u cuerpo) con una prenda de pixel art. Cada combinación de forma,
     * tamaño, paleta y contorno se genera una sola vez con el tamaño de píxel de la ilustración.
     */
    private dress(image: Phaser.GameObjects.Image, wear: HeadWear | null) {
      const anchor = this.headAnchor();
      const hidden = !wear || !anchor || this.view?.anim === 'dead' || this.view?.anim === 'bath';
      image.setVisible(!hidden);
      if (hidden || !wear || !anchor) return;
      const block = anchor.block ?? BLOCK;
      // Con una variante de color, el contorno de la prenda es el de esa variante.
      const variant = this.view ? findVariant(this.view.petId, this.view.variant) : null;
      const outline = variant ? variantOutline(variant) : anchor.outline;
      const key = `${wearKey(wear, anchor.size, outline)}-${block}`;
      const art = wear.kind === 'top-hat' ? buildTopHat(HAT_SIZES[anchor.size]) : buildCloth(wear.kind, anchor.size);
      if (!this.textures.exists(key)) {
        const canvas = document.createElement('canvas');
        canvas.width = art.width * block;
        canvas.height = art.height * block;
        const ctx = canvas.getContext('2d')!;
        const palette = findPalette(wear.palette);
        for (let i = 0; i < art.pixels.length; i++) {
          const color = wear.kind === 'top-hat' ? colorOf(art.pixels[i], palette, outline) : clothColor(art.pixels[i], palette, outline);
          if (color === null) continue;
          ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
          ctx.fillRect((i % art.width) * block, Math.floor(i / art.width) * block, block, block);
        }
        this.textures.addCanvas(key, canvas);
      }
      image.setTexture(key).setOrigin(art.pivot.x / art.width, art.pivot.y / art.height);
    }

    private dressHat() {
      this.dress(this.hat, this.wear);
      this.dress(this.outfit, this.outfitWear);
      this.followHead();
    }

    /** Ropa del cuerpo (poncho, paliacate, rebozo) o null. */
    setOutfit(wear: HeadWear | null) {
      this.outfitWear = wear;
      if (this.ready) this.dressHat();
    }

    /** Copia posición, giro, escala y tinte de la ilustración para que la prenda se mueva con ella. */
    private followHead() {
      const anchor = this.headAnchor();
      if (!anchor || !this.view) return;
      const frame = this.sprite.frame;
      // En la hoja del bebé ajolote cada cuadro tiene su postura: punto del cuerpo por cuadro.
      const points = bodyPoints(this.view.petId, this.view.stage, Number(frame.name) || 0);
      if (!points) return;
      const cos = Math.cos(this.sprite.rotation);
      const sin = Math.sin(this.sprite.rotation);
      /** Punto de la imagen original → posición en la escena (con giro y escala de la ilustración). */
      const toScene = (x: number, y: number) => {
        const lx = (x - frame.width / 2) * this.sprite.scaleX;
        const ly = (y - frame.height / 2) * this.sprite.scaleY;
        return { x: this.sprite.x + lx * cos - ly * sin, y: this.sprite.y + lx * sin + ly * cos };
      };
      const rotation = this.sprite.rotation + Phaser.Math.DegToRad(points.angle);
      const tinted = this.sprite.isTinted;
      const hatPoint = this.wear && this.wear.kind !== 'top-hat' && CLOTH_SLOT[this.wear.kind] === 'neck' ? points.neck : points.head;
      for (const [image, point] of [[this.hat, hatPoint], [this.outfit, points.neck]] as const) {
        if (!image.visible) continue;
        // El sombrero charro va en la cabeza aunque esté en la capa de cuerpo y viceversa: decide su lugar.
        const at = toScene(point.x, point.y);
        image.setPosition(at.x, at.y).setRotation(rotation).setScale(this.sprite.scaleX, this.sprite.scaleY).setAlpha(this.sprite.alpha);
        if (tinted) image.setTint(this.sprite.tint); else image.clearTint();
      }
      if (this.accessory.visible) {
        const place = placeOnBody(points, this.accessorySlot);
        const at = toScene(place.x, place.y);
        const size = this.accessory.frame.width || ICON_SIZE + 2;
        const scale = (place.width / size) * this.sprite.scaleX;
        this.accessory.setOrigin(0.5, place.originY).setPosition(at.x, at.y).setRotation(rotation)
          .setScale(scale, (place.width / size) * this.sprite.scaleY);
        if (tinted) this.accessory.setTint(this.sprite.tint); else this.accessory.clearTint();
      }
    }

    update(_t: number, delta: number) {
      if (!this.ready) return;
      this.followHead();
      if (this.roomGame) this.tickGame(delta);
    }

    /* ------------------------------------------------ jugar en la habitación */

    private roomGame: { ball: Phaser.GameObjects.Image; hud: Phaser.GameObjects.Text; score: number; coins: number; elapsed: number; onEnd: (r: MiniGameResult) => void } | null = null;
    private petHandler: (() => void) | null = null;

    isPlaying() { return this.roomGame !== null; }

    playInRoom(onEnd: (result: MiniGameResult) => void): boolean {
      const anim = this.view?.anim;
      if (!this.ready || !this.view || this.roomGame || anim === 'dead' || anim === 'bath' || anim === 'sleep') return false;
      const key = this.iconTexture('🎾');
      const ball = (key ? this.add.image(0, 0, key).setDisplaySize(40, 40) : this.add.image(0, 0, '__WHITE').setDisplaySize(30, 30).setTint(0xd7f542))
        .setDepth(20).setInteractive({ useHandCursor: true });
      const hud = this.add.text(W / 2, 16, '', {
        fontFamily: 'system-ui, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#fff7e6', backgroundColor: '#302b43cc', padding: { x: 10, y: 4 },
      }).setOrigin(0.5, 0).setDepth(21);
      this.roomGame = { ball, hud, score: 0, coins: 0, elapsed: 0, onEnd };
      ball.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); this.hitBall(); });
      this.moveBall();
      this.tweens.add({ targets: ball, angle: 360, duration: 900, repeat: -1 });
      this.drawGameHud();
      return true;
    }

    private moveBall() {
      if (!this.roomGame) return;
      const x = Phaser.Math.Between(60, W - 60);
      const y = Phaser.Math.Between(80, 250);
      this.roomGame.ball.setPosition(x, y);
      // La mascota corre hacia la pelota (solo de lado a lado, sin salirse del piso).
      this.tweens.killTweensOf(this.petRoot);
      this.petRoot.y = ROOM_POS.y;
      this.tweens.add({ targets: this.petRoot, x: Phaser.Math.Clamp(x, 110, W - 110), duration: 420, ease: 'Sine.inOut' });
      this.tweens.add({ targets: this.petRoot, y: ROOM_POS.y - 22, duration: 210, yoyo: true, ease: 'Sine.out' });
    }

    private hitBall() {
      const g = this.roomGame;
      if (!g) return;
      g.score += 1;
      g.coins += 1;
      const pop = this.add.text(g.ball.x, g.ball.y - 20, '+1', { fontFamily: 'system-ui, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#ffd23f', stroke: '#302b43', strokeThickness: 4 }).setOrigin(0.5).setDepth(22);
      this.tweens.add({ targets: pop, y: pop.y - 40, alpha: 0, duration: 700, onComplete: () => pop.destroy() });
      if (g.score >= BALL_TARGET) { g.coins += 2; this.endGame(); return; }
      this.moveBall();
      this.drawGameHud();
    }

    private drawGameHud() {
      const g = this.roomGame;
      if (!g) return;
      g.hud.setText(`Atrapa la pelota   ${Math.max(0, Math.ceil(BALL_SECONDS - g.elapsed / 1000))} s   ${g.score}/${BALL_TARGET}`);
    }

    private tickGame(delta: number) {
      const g = this.roomGame!;
      g.elapsed += delta;
      this.drawGameHud();
      if (g.elapsed >= BALL_SECONDS * 1000) this.endGame();
    }

    private endGame() {
      const g = this.roomGame;
      if (!g) return;
      this.roomGame = null;
      this.tweens.killTweensOf(g.ball);
      g.ball.destroy();
      g.hud.destroy();
      this.tweens.killTweensOf(this.petRoot);
      this.petRoot.y = ROOM_POS.y;
      this.tweens.add({ targets: this.petRoot, x: ROOM_POS.x, duration: 500, ease: 'Sine.inOut' });
      g.onEnd({ game: 'ball', score: g.score, coins: g.coins });
    }

    onPet(handler: () => void) { this.petHandler = handler; }

    /** Tocar a la mascota en la habitación: se alegra (corazón y saltito). */
    private touchPet(x: number, y: number) {
      if (this.roomGame || !this.view || !this.sprite.visible) return;
      const anim = this.view.anim;
      if (anim === 'dead' || anim === 'bath' || anim === 'sleep') return;
      if (!this.sprite.getBounds().contains(x, y)) return;
      this.react('❤️');
      this.tapReaction(anim);
      this.petHandler?.();
    }

    /**
     * Al tocar a la mascota hace algo propio de su especie (y sigue con lo que hacía). Los toques
     * seguidos van cambiando de gracia; si la tocan muchas veces rápido, se emociona y da un salto
     * grande. Todo por código: la ilustración no se modifica.
     */
    private tapReaction(anim: PetAnim) {
      if (anim === 'eat') return;
      const view = this.view;
      if (!view) return;
      const now = this.time.now;
      this.tapCount = now - this.lastTapAt < 1600 ? this.tapCount + 1 : 1;
      this.lastTapAt = now;
      const scale = this.spriteScale;
      const species = view.petId;
      const kind = (this.tapCount - 1) % 3;
      if (this.tapCount >= 5) {
        this.tapCount = 0;
        this.sparkle(4, ['★', '♪', '✦', '❤']);
        this.say('¡Qué felicidad!');
        this.chainOn([
          { scaleY: scale * 0.8, scaleX: scale * 1.15, duration: 100, ease: 'Quad.Out' },
          { scaleY: scale * 1.15, scaleX: scale * 0.9, y: -34, angle: 14, duration: 240, ease: 'Quad.Out' },
          { scaleY: scale * 1.05, scaleX: scale * 0.95, y: -34, angle: -14, duration: 200, ease: 'Sine.inOut' },
          { scaleY: scale, scaleX: scale, y: 0, angle: 0, duration: 260, ease: 'Bounce.Out' },
        ]);
        return;
      }
      if (species === 1) {
        // Lobo: menea el cuerpo, aúlla y se emociona.
        if (kind === 0) {
          this.say('¡Guau!');
          this.chainOn([{ angle: 7, duration: 70 }, { angle: -7, duration: 70 }, { angle: 6, duration: 70 }, { angle: -6, duration: 70 }, { angle: 0, duration: 80 }]);
        } else if (kind === 1) {
          this.say('¡Auuuu!');
          this.chainOn([
            { angle: -14, scaleY: scale * 1.1, y: -4, duration: 260, ease: 'Sine.out' },
            { angle: -14, duration: 600 },
            { angle: 0, scaleY: scale, y: 0, duration: 260, ease: 'Sine.inOut' },
          ]);
          this.sparkle(2, ['♪', '♫']);
        } else {
          this.chainOn([{ y: -18, scaleY: scale * 1.08, duration: 150, ease: 'Quad.Out' }, { y: 0, scaleY: scale, duration: 150, ease: 'Quad.In' }, { y: -10, duration: 110, ease: 'Quad.Out' }, { y: 0, duration: 110, ease: 'Quad.In' }]);
        }
      } else if (species === 2) {
        // Oso: se infla de ganas de abrazo, ruge suave o se ríe.
        if (kind === 0) {
          this.say('¡Grrr!');
          this.chainOn([{ scaleY: scale * 1.14, scaleX: scale * 1.02, y: -8, duration: 220, ease: 'Sine.out' }, { scaleY: scale * 1.14, duration: 380 }, { scaleY: scale, scaleX: scale, y: 0, duration: 220, ease: 'Sine.inOut' }]);
        } else if (kind === 1) {
          this.say('¡Abrazo!');
          this.chainOn([{ scaleX: scale * 1.12, scaleY: scale * 0.9, duration: 140, ease: 'Quad.Out' }, { scaleX: scale, scaleY: scale, duration: 140, yoyo: true, repeat: 1 }]);
          this.sparkle(3, ['❤', '✦']);
        } else {
          this.chainOn([{ angle: -6, duration: 120 }, { angle: 6, duration: 120 }, { angle: -6, duration: 120 }, { angle: 0, duration: 120 }]);
          this.say('¡Jo jo!');
        }
      } else if (species === 3) {
        // Tlacuache: se hace el muerto, voltea o pega un brinco asustado.
        if (kind === 0) {
          this.say('…');
          this.chainOn([
            { angle: 80, y: 22, duration: 220, ease: 'Quad.Out' },
            { angle: 80, y: 22, duration: 900 },
            { angle: 0, y: 0, duration: 200, ease: 'Back.Out' },
          ], () => this.say('¡Bu!'));
        } else if (kind === 1) {
          this.turnAround(scale);
          this.sparkle(2, ['✦', '❤']);
        } else {
          this.say('¡Ay!');
          this.chainOn([{ y: -26, scaleY: scale * 1.15, scaleX: scale * 0.88, duration: 140, ease: 'Quad.Out' }, { y: 0, scaleY: scale, scaleX: scale, duration: 180, ease: 'Bounce.Out' }]);
        }
      } else if (species === 4) {
        // Manatí: suelta burbujas, rueda despacio y canta.
        if (kind === 0) {
          this.say('¡Glub glub!');
          for (let i = 0; i < 5; i++) this.time.delayedCall(i * 90, () => this.bathBubble());
        } else if (kind === 1) {
          this.chainOn([{ angle: 10, y: -6, duration: 360, ease: 'Sine.inOut' }, { angle: -10, y: -2, duration: 520, ease: 'Sine.inOut' }, { angle: 0, y: 0, duration: 360, ease: 'Sine.inOut' }]);
          this.sparkle(2, ['♪', '♫']);
        } else {
          this.say('¡Mmm!');
          this.chainOn([{ scaleX: scale * 1.08, scaleY: scale * 0.94, duration: 200, ease: 'Sine.inOut' }, { scaleX: scale, scaleY: scale, duration: 260, ease: 'Sine.inOut' }]);
        }
      } else {
        // Ajolote: mueve las branquias, da una vuelta o burbujea.
        if (kind === 0) {
          this.say('¡Blub!');
          this.chainOn([{ angle: -5, duration: 60 }, { angle: 5, duration: 60 }, { angle: -5, duration: 60 }, { angle: 5, duration: 60 }, { angle: 0, duration: 70 }]);
        } else if (kind === 1) {
          this.turnAround(scale);
          this.sparkle(2, ['✦', '♪']);
        } else {
          this.chainOn([{ y: -16, scaleY: scale * 1.08, duration: 160, ease: 'Quad.Out' }, { y: 0, scaleY: scale, duration: 160, ease: 'Quad.In' }]);
          this.sparkle(2, ['❤', '★']);
        }
      }
    }

    /** Globito de texto corto que sube de la cabeza de la mascota. */
    private say(text: string) {
      const hd = this.petPoint('head');
      const t = this.add.text(hd.x + 8, hd.y - 24, text, {
        fontFamily: 'system-ui, sans-serif', fontSize: '17px', fontStyle: 'bold', color: '#fff6d8', stroke: '#302b43', strokeThickness: 4,
      }).setOrigin(0.5).setAlpha(0);
      this.bobber.add(t);
      this.eatObjects.push(t);
      this.tweens.add({ targets: t, alpha: 1, y: t.y - 14, duration: 180, ease: 'Sine.out' });
      this.tweens.add({ targets: t, alpha: 0, y: t.y - 36, delay: 900, duration: 500, onComplete: () => t.destroy() });
    }

    /** Textura de pixel art de un emoji (src/ui/pixelArt.ts), o null si no se pudo dibujar. */
    private iconTexture(emoji: string): string | null {
      const key = `px-${emoji}`;
      if (this.textures.exists(key)) return key;
      const canvas = pixelIconCanvas(emoji);
      if (!canvas) return null;
      this.textures.addCanvas(key, canvas);
      return key;
    }

    /** Imagen de pixel art (escala entera de píxeles) o, si no se puede, el emoji como texto. */
    private iconObject(emoji: string, x: number, y: number, scale: number): Phaser.GameObjects.Image | Phaser.GameObjects.Text {
      const key = this.iconTexture(emoji);
      if (key) return this.add.image(x, y, key).setScale(scale);
      return this.add.text(x, y, emoji, { fontSize: `${ICON_SIZE * scale}px` });
    }

    /** Muebles en el piso y adornos en la pared, en pixel art con la paleta del juego. */
    private drawDecor() {
      this.decorLayer.removeAll(true);
      const floorY = Math.round(H * 0.74);
      this.decor.furniture.forEach((icon, i) => {
        this.decorLayer.add(this.add.ellipse(FURNITURE_X[i], floorY + 26, 64, 10, 0x000000, 0.18));
        this.decorLayer.add(this.iconObject(icon, FURNITURE_X[i], floorY + 28, 4).setOrigin(0.5, 1));
      });
      this.decor.decor.forEach((icon, i) => {
        const { x, y } = DECOR_SPOTS[i];
        this.decorLayer.add(this.iconObject(icon, x, y, 3).setOrigin(0.5));
      });
    }

    /** Pone el accesorio sobre la cabeza: arriba de la ilustración, a la altura de la boca en x. */
    show(view: SceneView) {
      this.view = view;
      if (this.ready) this.apply(view);
    }

    react(icon: string, kind?: 'eat' | 'play') {
      if (kind === 'eat') {
        // La comida aparece en la boca cuando llega el estado `eat` (animateSprite).
        this.pendingFood = icon;
        if (this.ready && this.view?.anim === 'eat') { this.drawnKey = ''; this.apply(this.view); }
        return;
      }
      if (!this.ready || !this.view) return;
      const s = STAGE_SCALE[this.view.stage];
      this.tweens.add({ targets: this.petRoot, scaleX: s * 1.12, scaleY: s * 1.12, duration: 140, yoyo: true, ease: 'Back.Out' });
      const text = this.add.text(this.petRoot.x + 50, this.petRoot.y - 70, icon, { fontSize: '34px' }).setOrigin(0.5);
      this.tweens.add({ targets: text, y: text.y - 50, alpha: 0, duration: 1100, ease: 'Sine.out', onComplete: () => text.destroy() });
    }

    setRoomColors(colors: RoomColors) {
      this.roomColors = colors;
      if (this.roomGfx) this.paintRoom(this.roomGfx.clear());
    }

    resetBath() {
      this.scrub = { progress: 0, lastX: W * 0.78, lastY: H * 0.35, lastT: 0, lastBubble: 0 };
      if (this.ready) this.sponge.setPosition(this.scrub.lastX, this.scrub.lastY);
    }

    private apply(view: SceneView) {
      const bathing = view.anim === 'bath';
      const pos = bathing ? BATH_POS : ROOM_POS;
      const scale = STAGE_SCALE[view.stage];
      this.roomLayer.setVisible(!bathing);
      this.bathLayer.setVisible(bathing);
      this.tubFront.setVisible(bathing);
      this.sponge.setVisible(bathing);
      this.night.setVisible(view.anim === 'sleep');
      this.zzz.setVisible(view.anim === 'sleep');
      const placeKey = `${pos.x},${pos.y},${scale}`;
      if (placeKey !== this.placeKey) {
        this.placeKey = placeKey;
        this.petRoot.setPosition(pos.x, pos.y).setScale(scale);
      }
      this.game.canvas.style.touchAction = bathing ? 'none' : 'auto';

      if (view.anim === 'dead') { this.bob.pause(); this.bobber.y = 0; } else if (this.bob.isPaused()) { this.bob.resume(); }
      // Dormida el vaivén va más lento; el cambio de ritmo es gradual para que no dé un salto.
      const pace = view.anim === 'sleep' ? 0.45 : 1;
      if (this.bobPace !== pace) { this.bobPace = pace; this.tweens.add({ targets: this.bob, timeScale: pace, duration: 500, ease: 'Sine.inOut' }); }

      const key = `${view.petId}|${view.stage}|${view.anim}|${view.variant ?? ''}|${view.style ?? ''}`;
      if (key === this.drawnKey) return;
      this.drawnKey = key;
      // Accesorio: sigue a la mascota en su lugar del cuerpo (followHead); se oculta muerta y en el baño.
      this.accessory.setAlpha(view.anim === 'dead' || view.anim === 'bath' ? 0 : 1);

      const spriteAnim = this.findSprite(view);
      this.sprite.setVisible(spriteAnim !== null);
      this.placeholder.setVisible(spriteAnim === null);
      if (spriteAnim) {
        this.spriteKeyNow = spriteAnim.key;
        this.sprite.play(this.variantAnim(spriteAnim.key, view));
        // Misma altura visual que el marcador para que la escena no cambie al llegar los assets.
        const scale = (BODY.ry * 3) / spriteAnim.frameHeight;
        this.clearEat();
        this.spriteScale = scale;
        this.animateSprite(view, scale);
        this.dressHat();
        if (view.anim === 'eat') {
          const hasFrames = spriteAnim.key === spriteKey(view.petId, view.stage, 'eat');
          this.playEat(view, scale, hasFrames);
        }
        return;
      }
      this.clearEat();
      this.hat.setVisible(false);
      this.paintPlaceholder(view);
    }

    private clearEat() {
      for (const t of this.eatTimers) t.remove(false);
      for (const o of this.eatObjects) { this.tweens.killTweensOf(o); o.destroy(); }
      this.eatTimers = [];
      this.eatObjects = [];
    }

    /**
     * Comer, como los cuadros del ajolote bebé: sostiene la comida junto a la boca, le da tres
     * mordidas (se inclina hacia ella, se aplasta y suelta migajas), la comida se achica y al final
     * mastica contento. Si la ilustración ya trae cuadros de comer, solo se agregan las migajas.
     */
    private playEat(view: SceneView, scale: number, hasFrames: boolean) {
      const food = this.pendingFood;
      const drink = DRINKS.has(food);
      const fw = this.sprite.frame.width * scale;
      const fh = this.sprite.frame.height * scale;
      const m = MOUTH[view.petId]?.[view.stage] ?? { x: 0.62, y: 0.45 };
      const mouth = { x: (m.x - 0.5) * fw, y: (m.y - 0.5) * fh };
      // Mira a la derecha (x > 0.5): la comida va delante de la boca; si mira al frente, debajo.
      const front = m.x > 0.55;
      const hold = { x: mouth.x + (front ? 16 : 6), y: mouth.y + (front ? 6 : 20) };
      const colors = CRUMB[food] ?? [0xfff3d6, 0xd9873a];

      let item: Phaser.GameObjects.Text | null = null;
      if (!hasFrames) {
        item = this.add.text(hold.x, hold.y + 18, food, { fontSize: '30px' }).setOrigin(0.5).setAlpha(0).setScale(0.6);
        this.bobber.add(item);
        this.eatObjects.push(item);
        // Llega a la boca.
        this.tweens.add({ targets: item, y: hold.y, alpha: 1, scale: 1, duration: 160, ease: 'Back.Out' });
      }

      const bite = (index: number) => {
        // Se inclina hacia la comida y se aplasta, como al morder.
        this.tweens.add({
          targets: this.sprite, angle: front ? 6 : -4, x: front ? 5 : 0, y: 4,
          scaleX: scale * 1.05, scaleY: scale * 0.92, duration: 90, yoyo: true, ease: 'Quad.Out',
        });
        if (item) {
          const left = 1 - (index + 1) / BITES.length;
          this.tweens.add({ targets: item, x: mouth.x + (front ? 6 : 2), duration: 90, yoyo: true, ease: 'Quad.Out' });
          this.tweens.add({ targets: item, scale: Math.max(left, 0.15) * (drink ? 1 : 0.95) + (drink ? 0.1 : 0), angle: index % 2 ? 8 : -8, duration: 120 });
          if (left <= 0) this.tweens.add({ targets: item, alpha: 0, scale: 0.1, delay: 120, duration: 140 });
        }
        // Migajas (o gotas) que saltan y caen.
        for (let i = 0; i < (drink ? 2 : 3); i++) {
          const color = colors[i % colors.length];
          const crumb = drink
            ? this.add.circle(mouth.x + 6, mouth.y + 6, 3, color).setStrokeStyle(1, 0x5aa7c9)
            : this.add.rectangle(mouth.x + 6, mouth.y + 6, 5, 5, color).setStrokeStyle(1, INK);
          this.bobber.add(crumb);
          this.eatObjects.push(crumb);
          const dx = Phaser.Math.Between(front ? 4 : -22, 24);
          this.tweens.add({
            targets: crumb, x: crumb.x + dx, y: crumb.y - Phaser.Math.Between(8, 18), duration: 140, ease: 'Quad.Out',
            onComplete: () => this.tweens.add({ targets: crumb, y: crumb.y + 46, alpha: 0, angle: 90, duration: 420, ease: 'Quad.In' }),
          });
        }
      };
      BITES.forEach((at, i) => this.eatTimers.push(this.time.delayedCall(at, () => bite(i))));

      // Al terminar: mastica contento con un brillo, como los ojos cerrados del ajolote.
      this.eatTimers.push(this.time.delayedCall(BITES[BITES.length - 1] + 260, () => {
        this.tweens.add({ targets: this.sprite, scaleY: scale * 0.96, duration: 110, yoyo: true, repeat: 1, ease: 'Sine.inOut' });
        const happy = this.add.text(mouth.x - (front ? 34 : 0), mouth.y - fh * 0.32, drink ? '♪' : '✦', {
          fontFamily: 'system-ui, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#ffd23f', stroke: '#302b43', strokeThickness: 4,
        }).setOrigin(0.5).setAlpha(0);
        this.bobber.add(happy);
        this.eatObjects.push(happy);
        this.tweens.add({ targets: happy, alpha: 1, y: happy.y - 18, duration: 220, yoyo: true, hold: 120, ease: 'Sine.out' });
      }));
    }

    /** Da movimiento propio a los retratos de un fotograma en cada estado del juego. */
    private animateSprite(view: SceneView, scale: number) {
      const { anim, petId } = view;
      const sprite = this.sprite;
      const previous = this.lastAnim;
      this.lastAnim = anim;
      this.tweens.killTweensOf(sprite);
      // Al despertar, la ilustración se estira de nuevo en vez de saltar a su tamaño.
      const wasLying = previous === 'sleep' && anim !== 'sleep';
      const from = { x: sprite.scaleX, y: sprite.scaleY };
      sprite.clearTint().setAlpha(1).setScale(scale);
      if (wasLying) {
        sprite.setScale(from.x, from.y);
        this.tweens.add({ targets: sprite, scaleX: scale, scaleY: scale, duration: 450, ease: 'Sine.out' });
      }
      // Cada estado tiene una pose (posición e inclinación). Se llega a ella con una transición
      // corta desde la pose anterior en vez de saltar de golpe; después empieza su movimiento.
      const pose = (to: { x?: number; y?: number; angle?: number }, duration: number, then?: () => void) => {
        this.tweens.add({
          targets: sprite, x: to.x ?? 0, y: to.y ?? 0, angle: to.angle ?? 0, duration, ease: 'Sine.out',
          onComplete: then ? () => { if (this.view?.anim === anim) then(); } : undefined,
        });
      };
      const loop = (props: Record<string, number>, duration: number) =>
        this.tweens.add({ targets: sprite, ...props, duration, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      /** Repite `act` cada `min`–`max` ms mientras siga en este estado. */
      const every = (min: number, max: number, act: () => void) => {
        const next = () => this.eatTimers.push(this.time.delayedCall(Phaser.Math.Between(min, max), () => {
          if (this.view?.anim !== anim) return;
          // Lo que ya terminó se destruyó solo: no se acumula aunque pase horas en el mismo estado.
          this.eatObjects = this.eatObjects.filter((o) => o.active);
          this.eatTimers = this.eatTimers.filter((t) => t.getProgress() < 1);
          act();
          next();
        }));
        next();
      };
      if (anim === 'dead') {
        sprite.setTint(0x888888);
        pose({ y: 25, angle: 75 }, 650);
        return;
      }
      if (anim === 'sad') {
        // Cabizbaja: suspira, tiembla un poco y le salen lágrimas.
        sprite.setTint(0xb8c5dd);
        pose({ y: 8, angle: -4 }, 300, () => loop({ y: 12 }, 1100));
        every(1200, 2000, () => this.tear());
        every(2600, 4200, () => this.chainOn([
          { scaleY: scale * 0.94, scaleX: scale * 1.03, duration: 380, ease: 'Sine.inOut' },
          { scaleY: scale, scaleX: scale, duration: 520, ease: 'Sine.inOut' },
        ]));
        every(3500, 6000, () => this.shiver(scale));
        return;
      }
      if (anim === 'sleep') {
        // Se echa en el piso como el ajolote bebé (cuerpo aplastado y ancho, ojos cerrados), respira
        // lento, a veces se acomoda otra vez y ronca. El manatí flota, así que solo se hunde un poco.
        // La ilustración no se toca: solo se le da otra proporción por código.
        const framed = this.spriteKeyNow === spriteKey(view.petId, view.stage, 'sleep'); // el ajolote bebé ya trae su cuadro
        const lie = framed ? { sx: 1, sy: 1 } : petId === 4 ? { sx: 1.04, sy: 0.9 } : { sx: 1.12, sy: 0.74 };
        const drop = framed ? 8 : ((1 - lie.sy) / 2) * BODY.ry * 3 + 14;
        this.tweens.add({
          targets: sprite, x: 0, y: drop, angle: -3, scaleX: scale * lie.sx, scaleY: scale * lie.sy, duration: 900, ease: 'Sine.inOut',
          onComplete: () => { if (this.view?.anim === 'sleep') loop({ scaleY: scale * lie.sy * 1.05 }, 1550); },
        });
        every(5000, 9000, () => this.chainOn([
          { angle: Phaser.Math.Between(-7, 1), x: Phaser.Math.Between(-4, 4), duration: 900, ease: 'Sine.inOut' },
        ]));
        every(2400, 3600, () => this.snore());
        return;
      }
      if (anim === 'play') {
        // Saltos con estirón al subir y aplastón al caer; estrellas y notas al aterrizar.
        pose({}, 180, () => {
          const hop = () => {
            if (this.view?.anim !== 'play') return;
            const high = petId === 4 ? -10 : petId === 2 ? -14 : -24;
            this.chainOn([
              { scaleY: scale * 0.86, scaleX: scale * 1.1, y: 4, duration: 110, ease: 'Quad.Out' },
              { scaleY: scale * 1.1, scaleX: scale * 0.92, y: high, angle: Phaser.Math.Between(-9, 9), duration: 220, ease: 'Quad.Out' },
              { scaleY: scale, scaleX: scale, y: 0, angle: 0, duration: 200, ease: 'Quad.In' },
              { scaleY: scale * 0.9, scaleX: scale * 1.07, duration: 80, yoyo: true, ease: 'Quad.Out' },
            ], () => { this.sparkle(2, ['♪', '✦', '★']); hop(); });
          };
          hop();
        });
        return;
      }
      if (anim === 'eat') {
        // Las mordidas las anima playEat; aquí solo se acerca un poco a la comida.
        pose({ y: 2 }, 160);
        return;
      }
      if (anim === 'bath') {
        // Se mece en la tina, le salen burbujas y de vez en cuando se sacude.
        pose({}, 200, () => loop({ angle: 4 }, 360));
        every(250, 500, () => this.bathBubble());
        every(2500, 4000, () => this.shakeOff(scale, false));
        return;
      }
      // Normal: respira, parpadea, mira hacia atrás, da saltitos y se estira.
      pose({}, 450, () => {
        if (petId === 4) loop({ y: -5, angle: 2 }, 1500);
        else loop({ scaleY: scale * 1.025 }, 1000);
      });
      if (previous === 'bath') this.shakeOff(scale, true);
      every(2200, 4200, () => this.blink());
      every(3500, 6500, () => {
        const act = Phaser.Math.Between(0, 3);
        if (act === 0) this.turnAround(scale);
        else if (act === 1) this.chainOn([
          { y: -14, scaleY: scale * 1.06, duration: 180, ease: 'Quad.Out' },
          { y: 0, scaleY: scale, duration: 160, ease: 'Quad.In' },
          { scaleY: scale * 0.93, scaleX: scale * 1.05, duration: 80, yoyo: true },
        ]);
        else if (act === 2) this.chainOn([
          { angle: -6, scaleY: scale * 1.07, duration: 420, ease: 'Sine.inOut' },
          { angle: 0, scaleY: scale, duration: 380, ease: 'Sine.inOut' },
        ]);
        else this.chainOn([{ angle: 5, duration: 90 }, { angle: -5, duration: 120 }, { angle: 4, duration: 110 }, { angle: 0, duration: 100 }]);
      });
    }

    /* ------------------------------------------------ efectos de las interacciones */

    /** Encadena pasos sobre la ilustración. */
    private chainOn(steps: Step[], then?: () => void) {
      const anim = this.view?.anim;
      this.tweens.chain({
        targets: this.sprite, tweens: steps as Phaser.Types.Tweens.TweenBuilderConfig[],
        onComplete: then ? () => { if (this.view?.anim === anim) then(); } : undefined,
      });
    }

    /** Punto del cuerpo (ojos, cabeza o cuello) en coordenadas del contenedor de la mascota. */
    private petPoint(part: 'eyes' | 'head' | 'neck'): { x: number; y: number; span: number } {
      const frame = this.sprite.frame;
      const p = this.view ? bodyPoints(this.view.petId, this.view.stage, Number(frame.name) || 0) : null;
      const sx = this.sprite.scaleX;
      const sy = this.sprite.scaleY;
      if (!p) return { x: this.sprite.x, y: this.sprite.y - 30, span: 30 };
      const at = part === 'eyes' ? p.eyes : part === 'head' ? p.head : p.neck;
      return { x: this.sprite.x + (at.x - frame.width / 2) * sx, y: this.sprite.y + (at.y - frame.height / 2) * sy, span: p.eyes.span * Math.abs(sx) };
    }

    /** Píxel cuadrado con contorno, como el resto del dibujo. Se limpia al cambiar de estado. */
    private pixel(x: number, y: number, size: number, color: number) {
      const r = this.add.rectangle(x, y, size, size, color).setStrokeStyle(1, INK);
      this.bobber.add(r);
      this.eatObjects.push(r);
      return r;
    }

    /** Parpadeo: un instante con los ojos cerrados por código (ilustraciones de una sola imagen). */
    private blink() {
      const view = this.view;
      if (!view || !this.spriteKeyNow || !EYES[view.petId]?.[view.stage]) return;
      const open = this.variantAnim(this.spriteKeyNow, view);
      const closed = this.variantAnim(this.spriteKeyNow, { ...view, anim: 'sleep' });
      if (closed === open) return;
      this.sprite.play(closed);
      this.eatTimers.push(this.time.delayedCall(140, () => {
        if (this.view && this.view.anim === view.anim) this.sprite.play(this.variantAnim(this.spriteKeyNow, this.view));
      }));
    }

    /** Se voltea a ver hacia atrás y regresa (la ropa y los accesorios se voltean con ella). */
    private turnAround(scale: number) {
      this.chainOn([
        { scaleX: -scale, duration: 160, ease: 'Sine.inOut' },
        { scaleX: -scale, duration: 700 },
        { scaleX: scale, duration: 160, ease: 'Sine.inOut' },
      ]);
    }

    private shiver(scale: number) {
      this.chainOn([{ x: -2, duration: 40 }, { x: 2, duration: 40 }, { x: -2, duration: 40 }, { x: 2, duration: 40 }, { x: 0, scaleX: scale, duration: 40 }]);
    }

    /** Lágrima que sale de un ojo y cae. */
    private tear() {
      const e = this.petPoint('eyes');
      const side = Math.random() < 0.5 ? -1 : 1;
      const d = this.pixel(e.x + side * e.span * 0.35, e.y + 6, 5, 0x6fb6ff);
      this.tweens.add({ targets: d, y: d.y + 42, alpha: 0, duration: 900, ease: 'Quad.In', onComplete: () => d.destroy() });
    }

    /** "z" que sale de la cabeza al roncar. */
    private snore() {
      const hd = this.petPoint('head');
      const z = this.add.text(hd.x + 20, hd.y, 'z', {
        fontFamily: 'system-ui, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#fff6d8', stroke: '#302b43', strokeThickness: 3,
      }).setOrigin(0.5);
      this.bobber.add(z);
      this.eatObjects.push(z);
      this.tweens.add({ targets: z, x: z.x + 26, y: z.y - 40, scale: 1.6, alpha: 0, duration: 1500, ease: 'Sine.out', onComplete: () => z.destroy() });
    }

    /** Estrellas o notas que saltan de la cabeza. */
    private sparkle(count: number, glyphs: string[]) {
      const hd = this.petPoint('head');
      const colors = ['#ffd23f', '#ff8cc6', '#7fe0d8'];
      for (let i = 0; i < count; i++) {
        const t = this.add.text(hd.x + Phaser.Math.Between(-30, 30), hd.y + 10, Phaser.Utils.Array.GetRandom(glyphs), {
          fontFamily: 'system-ui, sans-serif', fontSize: '18px', fontStyle: 'bold', color: Phaser.Utils.Array.GetRandom(colors), stroke: '#302b43', strokeThickness: 3,
        }).setOrigin(0.5);
        this.bobber.add(t);
        this.eatObjects.push(t);
        this.tweens.add({ targets: t, y: t.y - Phaser.Math.Between(30, 55), x: t.x + Phaser.Math.Between(-20, 20), alpha: 0, duration: 800, ease: 'Sine.out', onComplete: () => t.destroy() });
      }
    }

    /** Burbuja que sube del cuerpo en la tina. */
    private bathBubble() {
      const n = this.petPoint('neck');
      const b = this.add.circle(n.x + Phaser.Math.Between(-60, 60), n.y + Phaser.Math.Between(-10, 40), Phaser.Math.Between(4, 10), 0xffffff, 0.85)
        .setStrokeStyle(1.5, 0x9fd3dc);
      this.bobber.add(b);
      this.eatObjects.push(b);
      this.tweens.add({ targets: b, y: b.y - Phaser.Math.Between(50, 90), x: b.x + Phaser.Math.Between(-12, 12), alpha: 0, duration: 1400, ease: 'Sine.out', onComplete: () => b.destroy() });
    }

    /** Se sacude el agua: vibra de lado a lado y salen gotas; al salir del baño, además brilla. */
    private shakeOff(scale: number, clean: boolean) {
      const steps: Step[] = [];
      for (let i = 0; i < 6; i++) steps.push({ angle: i % 2 ? -8 : 8, scaleX: scale * (i % 2 ? 0.97 : 1.03), duration: 55 });
      steps.push({ angle: 0, scaleX: scale, duration: 80 });
      this.chainOn(steps);
      const c = this.petPoint('neck');
      for (let i = 0; i < 10; i++) {
        const d = this.pixel(c.x, c.y - 10, 5, i % 3 ? 0x8fd3d6 : 0xffffff);
        const a = Phaser.Math.DegToRad(Phaser.Math.Between(200, 340));
        const r = Phaser.Math.Between(50, 95);
        this.tweens.add({
          targets: d, x: c.x + Math.cos(a) * r, y: c.y - 10 + Math.sin(a) * r * 0.7, duration: 260, ease: 'Quad.Out',
          onComplete: () => this.tweens.add({ targets: d, y: d.y + 40, alpha: 0, duration: 380, ease: 'Quad.In', onComplete: () => d.destroy() }),
        });
      }
      if (clean) this.eatTimers.push(this.time.delayedCall(450, () => this.sparkle(4, ['✦', '✧'])));
    }

    /**
     * Animación con la variante de color aplicada. La primera vez recolorea la imagen original
     * (mapa de degradado, sin redibujar) y registra su textura y su animación; después la reutiliza.
     */
    private variantAnim(key: string, view: SceneView): string {
      const ramp = SPECIES_RAMPS[view.petId];
      const variant = ramp ? findVariant(view.petId, view.variant) : null;
      const sheet = SPRITES.find((s) => spriteKey(s.petId, s.stage, s.anim) === key);
      if (!sheet) return key;
      // Dormida sin cuadros propios de dormir (una sola ilustración): ojos cerrados por código.
      const eyes = view.anim === 'sleep' && sheet.anim !== 'sleep' ? EYES[view.petId]?.[sheet.stage] : undefined;
      const real = view.style === 'pixel';
      if (!variant && !eyes && !real) return key;
      const vkey = `${key}${variant ? `@${variant.id}` : ''}${eyes ? '~zz' : ''}${real ? '#px' : ''}`;
      if (this.anims.exists(vkey)) return vkey;
      if (!this.textures.exists(vkey)) {
        const source = this.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
        let bySource = this.recolored.get(source);
        if (!bySource) { bySource = new Map(); this.recolored.set(source, bySource); }
        const cacheId = `${variant?.id ?? ''}${eyes ? '~zz' : ''}${real ? '#px' : ''}`;
        let canvas = bySource.get(cacheId);
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.width = source.width;
          canvas.height = source.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
          ctx.drawImage(source, 0, 0);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
          let data: Uint8ClampedArray = pixels.data;
          if (ramp && variant) data = recolorPixels(data, canvas.width, canvas.height, ramp, variant);
          if (eyes) data = closeEyes(data, canvas.width, canvas.height, eyes);
          // Píxel real: bloques de 10 en las ilustraciones y de 4 en la hoja del bebé ajolote.
          if (real) data = toRealPixelArt(data, canvas.width, canvas.height, { ...PIXEL_STYLE, block: sheet.frameWidth < 600 ? 4 : PIXEL_STYLE.block });
          pixels.data.set(data);
          ctx.putImageData(pixels, 0, 0);
          bySource.set(cacheId, canvas);
        }
        this.textures.addSpriteSheet(vkey, canvas as unknown as HTMLImageElement, spriteSheetConfig(sheet));
      }
      this.anims.create({ key: vkey, frames: this.anims.generateFrameNumbers(vkey, {
        ...(sheet.firstFrame === undefined ? {} : { start: sheet.firstFrame }),
        ...(sheet.lastFrame === undefined ? {} : { end: sheet.lastFrame }),
      }), frameRate: sheet.fps, repeat: sheet.loop === false ? 0 : -1 });
      return vkey;
    }

    private findSprite(view: SceneView): { key: string; frameHeight: number } | null {
      // Conserva la etapa visible: si una acción no tiene cuadros propios,
      // anima el retrato de esa misma edad antes de buscar arte de otra edad.
      for (const stage of [view.stage, 'baby'] as const) {
        for (const anim of [view.anim, 'idle'] as const) {
          const key = spriteKey(view.petId, stage, anim);
          const sheet = SPRITES.find((s) => s.petId === view.petId && s.stage === stage && s.anim === anim);
          if (sheet && this.anims.exists(key)) return { key, frameHeight: sheet.frameHeight };
        }
      }
      return null;
    }

    private paintPlaceholder(view: SceneView) {
      const species = findPet(view.petId);
      const colors = view.anim === 'dead' || !species ? DEAD_COLORS : species;
      this.body.setFillStyle(colors.color).setStrokeStyle(4, colors.outline);
      for (const ear of this.ears) ear.setFillStyle(colors.color).setStrokeStyle(3, colors.outline);
      this.belly.setFillStyle(colors.belly);
      for (const b of this.blush) b.setVisible(view.anim !== 'dead');
      this.drawFace(view.anim);
    }

    private drawFace(anim: PetAnim) {
      const g = this.face.clear();
      const rad = Phaser.Math.DegToRad;
      g.lineStyle(3, INK, 1);
      if (anim === 'sleep') {
        for (const x of [-23, 23]) { g.beginPath(); g.arc(x, -9, 7, rad(20), rad(160), false); g.strokePath(); }
      } else if (anim === 'dead') {
        for (const x of [-23, 23]) {
          g.lineBetween(x - 6, -13, x + 6, -1);
          g.lineBetween(x + 6, -13, x - 6, -1);
        }
      } else {
        g.fillStyle(INK, 1);
        g.fillEllipse(-23, -7, 10, anim === 'sad' ? 10 : 14);
        g.fillEllipse(23, -7, 10, anim === 'sad' ? 10 : 14);
      }
      g.lineStyle(2.5, 0x51405b, 1);
      if (anim === 'eat') { g.fillStyle(0x51405b, 1); g.fillEllipse(0, 14, 16, 12); }
      else if (anim === 'sad') { g.beginPath(); g.arc(0, 22, 9, rad(205), rad(335), false); g.strokePath(); }
      else if (anim === 'dead') { g.lineBetween(-8, 16, 8, 16); }
      else if (anim === 'sleep') { g.strokeCircle(0, 15, 3); }
      else { g.beginPath(); g.arc(0, 8, 9, rad(15), rad(165), false); g.strokePath(); }
    }

    private moveSponge(x: number, y: number, jump = false) {
      if (!this.view || this.view.anim !== 'bath') return;
      const now = this.time.now;
      this.sponge.setPosition(x, y);
      const moved = jump ? 0 : Math.hypot(x - this.scrub.lastX, y - this.scrub.lastY);
      const dt = this.scrub.lastT ? now - this.scrub.lastT : 16;
      const s = STAGE_SCALE[this.view.stage];
      const touching = spongeTouchesPet(
        { x, y, r: SPONGE_R },
        { x: this.petRoot.x, y: this.petRoot.y + BODY.offsetY * s, rx: BODY.rx * s, ry: BODY.ry * s },
      );
      const next = scrubProgress(this.scrub.progress, moved, touching, dt);
      this.scrub = { ...this.scrub, lastX: x, lastY: y, lastT: now };
      if (touching && moved > 3 && now - this.scrub.lastBubble > 70) { this.scrub.lastBubble = now; this.bubble(x, y); }
      if (next !== this.scrub.progress) { this.scrub.progress = next; onScrub(next); }
    }

    private bubble(x: number, y: number) {
      const b = this.add.circle(x + Phaser.Math.Between(-18, 18), y + Phaser.Math.Between(-10, 10), Phaser.Math.Between(4, 9), 0xffffff, 0.85)
        .setStrokeStyle(1.5, 0x9fd3dc);
      this.tweens.add({ targets: b, y: b.y - Phaser.Math.Between(25, 50), alpha: 0, duration: 900, onComplete: () => b.destroy() });
    }

    private drawRoom() {
      this.roomGfx = this.paintRoom(this.add.graphics());
      return this.roomGfx;
    }

    private paintRoom(g: Phaser.GameObjects.Graphics) {
      const floorY = Math.round(H * 0.74);
      // Pared con franjas: color del tema, o el de la pared elegida en "Mi espacio".
      const wall = this.decor.wall ?? this.roomColors.wall;
      const stripe = this.decor.wall === null ? this.roomColors.stripe : darker(this.decor.wall, 0.92);
      g.fillStyle(wall, 1); g.fillRect(0, 0, W, H);
      g.fillStyle(stripe, 1);
      for (let x = 0; x < W; x += 40) g.fillRect(x, 0, 20, floorY);
      // Ventana con atardecer.
      const wx = Math.round(W * 0.08), wy = 46;
      g.fillStyle(INK, 1); g.fillRect(wx, wy, 112, 92);
      g.fillStyle(0xff9e5e, 1); g.fillRect(wx + 6, wy + 6, 100, 40);
      g.fillStyle(0xffc46b, 1); g.fillRect(wx + 6, wy + 46, 100, 40);
      g.fillStyle(0xfff3b0, 1); g.fillRect(wx + 68, wy + 30, 22, 22);
      g.fillStyle(0x3d7a3a, 1); g.fillRect(wx + 14, wy + 62, 10, 24); g.fillRect(wx + 8, wy + 70, 8, 6); g.fillRect(wx + 22, wy + 66, 8, 6);
      g.fillStyle(INK, 1); g.fillRect(wx + 53, wy, 6, 92); g.fillRect(wx, wy + 43, 112, 6);
      // Lambrín de azulejos de talavera.
      const tileY = floorY - 36;
      for (let x = 0; x < W; x += 36) this.talaveraTile(g, x, tileY, 36);
      g.fillStyle(INK, 1); g.fillRect(0, tileY - 4, W, 4); g.fillRect(0, floorY, W, 5);
      // Piso de tablas: madera, o el piso elegido en "Mi espacio".
      const floor = this.decor.floor ?? 0x8e5a3a;
      g.fillStyle(floor, 1); g.fillRect(0, floorY + 5, W, H);
      g.fillStyle(darker(floor), 1);
      for (let y = floorY + 25; y < H; y += 22) g.fillRect(0, y, W, 3);
      // Tapete de sarape debajo de la mascota.
      const rx = 150, ry = floorY + 16, rw = 220, rh = 52;
      // Franjas negro, rojo, verde, rosa y verde, repetidas dos veces.
      const black = 0x141414;
      const stripes = [black, MX.red, MX.green, MX.pink, MX.green, black, MX.red, MX.green, MX.pink, MX.green];
      g.fillStyle(INK, 1); g.fillRect(rx - 4, ry - 4, rw + 8, rh + 8);
      stripes.forEach((color, i) => { g.fillStyle(color, 1); g.fillRect(rx, ry + (i * rh) / stripes.length, rw, rh / stripes.length + 1); });
      g.fillStyle(0xfff3d6, 1);
      for (let y = ry; y < ry + rh; y += 8) { g.fillRect(rx - 12, y, 8, 3); g.fillRect(rx + rw + 4, y, 8, 3); }
      // Nopal en maceta de talavera.
      const px = Math.round(W * 0.8), pyTop = floorY + 2;
      g.fillStyle(INK, 1);
      g.fillEllipse(px + 22, pyTop - 44, 36, 48); g.fillEllipse(px + 6, pyTop - 82, 28, 38); g.fillEllipse(px + 40, pyTop - 76, 26, 34);
      g.fillStyle(MX.green, 1);
      g.fillEllipse(px + 22, pyTop - 44, 30, 42); g.fillEllipse(px + 6, pyTop - 82, 22, 32); g.fillEllipse(px + 40, pyTop - 76, 20, 28);
      g.fillStyle(0xfff3b0, 1);
      for (const [dx, dy] of [[16, -54], [28, -38], [18, -30], [4, -88], [8, -74], [38, -84], [44, -70]] as const) g.fillRect(px + dx, pyTop + dy, 3, 3);
      g.fillStyle(MX.pink, 1); g.fillRect(px + 2, pyTop - 104, 8, 8); g.fillRect(px + 38, pyTop - 96, 8, 8);
      g.fillStyle(INK, 1); g.fillRect(px - 4, pyTop - 24, 52, 46);
      g.fillStyle(0xf4f1e8, 1); g.fillRect(px, pyTop - 20, 44, 38);
      g.fillStyle(MX.blue, 1); g.fillRect(px, pyTop - 12, 44, 6); g.fillRect(px + 8, pyTop + 2, 6, 6); g.fillRect(px + 30, pyTop + 2, 6, 6);
      g.fillStyle(MX.yellow, 1); g.fillRect(px + 19, pyTop + 2, 6, 6);
      // Papel picado colgado de una cuerda.
      this.papelPicado(g, wall);
      return g;
    }

    /** Azulejo de talavera: fondo blanco, rombo azul, flor amarilla al centro y esquinas. */
    private talaveraTile(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number) {
      const c = size / 2;
      g.fillStyle(0xf7f3ea, 1); g.fillRect(x, y, size, size);
      g.fillStyle(MX.blue, 1);
      g.fillTriangle(x + c, y + 4, x + size - 4, y + c, x + c, y + size - 4);
      g.fillTriangle(x + c, y + 4, x + 4, y + c, x + c, y + size - 4);
      g.fillRect(x, y, 6, 6); g.fillRect(x + size - 6, y, 6, 6); g.fillRect(x, y + size - 6, 6, 6); g.fillRect(x + size - 6, y + size - 6, 6, 6);
      g.fillStyle(0xf7f3ea, 1); g.fillRect(x + c - 6, y + c - 6, 12, 12);
      g.fillStyle(MX.yellow, 1); g.fillRect(x + c - 3, y + c - 3, 6, 6);
      g.lineStyle(1.5, 0x9db4d8, 1); g.strokeRect(x, y, size, size);
    }

    private papelPicado(g: Phaser.GameObjects.Graphics, hole: number) {
      const colors = [MX.pink, MX.orange, MX.yellow, MX.turquoise, MX.green, MX.purple, MX.red];
      g.fillStyle(INK, 1); g.fillRect(0, 8, W, 3);
      for (let i = 0, x = 6; x < W; i += 1, x += 52) {
        const fw = 42, fh = 30, top = 11;
        g.fillStyle(colors[i % colors.length], 1);
        g.fillRect(x, top, fw, fh);
        for (let t = 0; t < 4; t += 1) g.fillTriangle(x + (t * fw) / 4, top + fh, x + ((t + 1) * fw) / 4, top + fh, x + ((t + 0.5) * fw) / 4, top + fh + 7);
        // Calados del papel.
        g.fillStyle(hole, 1);
        for (const [dx, dy] of [[8, 7], [19, 7], [30, 7], [13, 16], [25, 16], [19, 24]] as const) g.fillRect(x + dx, top + dy, 4, 4);
      }
    }

    /** Elipse con contorno de tinta (estilo pixel). */
    private blob(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, outline = 3) {
      g.fillStyle(INK, 1); g.fillEllipse(x, y, w + outline * 2, h + outline * 2);
      g.fillStyle(color, 1); g.fillEllipse(x, y, w, h);
    }

    /** Rectángulo con contorno de tinta. */
    private box(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, outline = 3) {
      g.fillStyle(INK, 1); g.fillRect(x - outline, y - outline, w + outline * 2, h + outline * 2);
      g.fillStyle(color, 1); g.fillRect(x, y, w, h);
    }

    /** Guitarra colgada de un clavo en la pared, entre la mascota y la piñata. */
    private drawGuitar() {
      const g = this.add.graphics();
      const wood = 0xd9873a, dark = 0x5a3a22, neck = 0x8b5a2b;
      // Clavo y cordón.
      g.lineStyle(2, INK, 1); g.lineBetween(-8, 10, 0, 0); g.lineBetween(8, 10, 0, 0);
      g.fillStyle(INK, 1); g.fillRect(-3, -3, 6, 6);
      // Clavijero con clavijas.
      this.box(g, -8, 8, 16, 20, dark, 2);
      g.fillStyle(0xf7f3ea, 1);
      for (const y of [11, 17, 23]) { g.fillRect(-14, y, 5, 4); g.fillRect(9, y, 5, 4); }
      // Mástil con trastes.
      this.box(g, -5, 28, 10, 52, neck, 2);
      g.fillStyle(MX.yellow, 1);
      for (let y = 34; y < 80; y += 9) g.fillRect(-5, y, 10, 2);
      // Caja: dos curvas con boca, roseta turquesa, flores pintadas y puente.
      this.blob(g, 0, 94, 42, 36, wood);
      this.blob(g, 0, 126, 56, 46, wood);
      g.fillStyle(wood, 1); g.fillEllipse(0, 94, 42, 36);
      g.fillStyle(MX.turquoise, 1); g.fillCircle(0, 106, 12);
      g.fillStyle(INK, 1); g.fillCircle(0, 106, 8);
      g.fillStyle(MX.pink, 1); g.fillRect(-20, 124, 6, 6); g.fillRect(14, 130, 6, 6);
      g.fillStyle(MX.yellow, 1); g.fillRect(-14, 132, 5, 5); g.fillRect(9, 122, 5, 5);
      g.fillStyle(MX.green, 1); g.fillRect(-22, 132, 5, 3); g.fillRect(19, 126, 5, 3);
      g.fillStyle(dark, 1); g.fillRect(-12, 136, 24, 5);
      g.lineStyle(1, 0xfff3d6, 0.9); g.lineBetween(-2, 28, -2, 136); g.lineBetween(2, 28, 2, 136);
      const guitar = this.add.container(368, 56, [g]).setScale(0.9).setAngle(-6);
      this.tweens.add({ targets: guitar, angle: { from: -7, to: -4 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      return guitar;
    }

    /** Par de maracas cruzadas colgadas junto a la ventana. */
    private drawMaracas() {
      const maraca = (angle: number, colors: readonly number[]) => {
        const g = this.add.graphics();
        this.box(g, -3, 0, 6, 32, 0x8b5a2b, 2);
        this.blob(g, 0, -16, 22, 30, colors[0], 2);
        g.fillStyle(colors[1], 1); g.fillRect(-10, -22, 20, 5);
        g.fillStyle(colors[2], 1); g.fillRect(-10, -12, 20, 5);
        g.fillStyle(0xffffff, 0.8); g.fillRect(-6, -26, 4, 4);
        return this.add.container(0, 0, [g]).setAngle(angle);
      };
      const bow = this.add.graphics();
      bow.fillStyle(INK, 1); bow.fillRect(-3, -3, 6, 6);
      bow.fillStyle(MX.pink, 1); bow.fillTriangle(-12, -8, -12, 8, 0, 0); bow.fillTriangle(12, -8, 12, 8, 0, 0);
      return this.add.container(178, 100, [
        maraca(-24, [MX.red, MX.yellow, MX.green]),
        maraca(24, [MX.turquoise, MX.pink, MX.yellow]),
        bow,
      ]);
    }

    /** Juguetes en el piso: mariachi de peluche, muñeca de trapo y balero. */
    private drawToys() {
      const g = this.add.graphics();
      const floorY = Math.round(H * 0.74);
      const shade = 0x6f4329;

      // Mariachi de peluche (esquina izquierda).
      const mx = 64, base = floorY + 30;
      g.fillStyle(shade, 1); g.fillEllipse(mx, base + 2, 84, 12);
      this.blob(g, mx - 16, base - 6, 22, 14, 0x1b1b1b);
      this.blob(g, mx + 16, base - 6, 22, 14, 0x1b1b1b);
      this.blob(g, mx, base - 30, 54, 50, 0x1b1b1b);
      g.fillStyle(MX.yellow, 1);
      for (const y of [-44, -34, -24]) { g.fillRect(mx - 12, base + y, 4, 4); g.fillRect(mx + 8, base + y, 4, 4); }
      g.fillRect(mx - 26, base - 30, 4, 18); g.fillRect(mx + 22, base - 30, 4, 18);
      this.blob(g, mx - 16, base - 74, 14, 14, 0xb07a4a, 2);
      this.blob(g, mx + 16, base - 74, 14, 14, 0xb07a4a, 2);
      this.blob(g, mx, base - 64, 40, 38, 0xb07a4a);
      g.fillStyle(0xe8c39e, 1); g.fillEllipse(mx, base - 56, 20, 13);
      g.fillStyle(INK, 1); g.fillRect(mx - 9, base - 70, 5, 5); g.fillRect(mx + 4, base - 70, 5, 5); g.fillRect(mx - 3, base - 60, 6, 4);
      g.fillStyle(MX.red, 1); g.fillTriangle(mx, base - 44, mx - 12, base - 50, mx - 12, base - 38); g.fillTriangle(mx, base - 44, mx + 12, base - 50, mx + 12, base - 38);
      // Sombrero de charro con galón dorado.
      g.fillStyle(INK, 1); g.fillEllipse(mx, base - 84, 96, 24);
      g.fillStyle(MX.yellow, 1); g.fillEllipse(mx, base - 84, 90, 19);
      g.fillStyle(0x222222, 1); g.fillEllipse(mx, base - 84, 82, 13);
      this.blob(g, mx, base - 98, 30, 28, 0x222222);
      g.fillStyle(MX.yellow, 1); g.fillRect(mx - 15, base - 92, 30, 4);
      g.fillRect(mx - 40, base - 86, 5, 4); g.fillRect(mx + 35, base - 86, 5, 4);

      // Muñeca de trapo con listones de colores (esquina derecha).
      const dx = 492, dBase = floorY + 30;
      g.fillStyle(shade, 1); g.fillEllipse(dx, dBase + 2, 48, 10);
      // Falda escalonada: primero los contornos y luego el relleno, para que no queden líneas entre niveles.
      const skirtWidths = [24, 30, 36, 42];
      skirtWidths.forEach((w, i) => this.box(g, dx - w / 2, dBase - 44 + i * 11, w, 11, MX.pink, 2));
      g.fillStyle(MX.pink, 1);
      skirtWidths.forEach((w, i) => g.fillRect(dx - w / 2, dBase - 44 + i * 11, w, 11));
      g.fillStyle(MX.yellow, 1); g.fillRect(dx - 15, dBase - 31, 30, 3);
      g.fillStyle(MX.turquoise, 1); g.fillRect(dx - 21, dBase - 9, 42, 4);
      this.box(g, dx - 10, dBase - 58, 20, 14, MX.green, 2);
      this.box(g, dx - 17, dBase - 56, 5, 18, 0xf0c9a0, 2);
      this.box(g, dx + 12, dBase - 56, 5, 18, 0xf0c9a0, 2);
      this.blob(g, dx, dBase - 72, 26, 26, 0xf0c9a0);
      g.fillStyle(0x2b1a12, 1); g.fillEllipse(dx, dBase - 80, 28, 12);
      g.fillRect(dx - 16, dBase - 78, 5, 26); g.fillRect(dx + 11, dBase - 78, 5, 26);
      g.fillStyle(MX.pink, 1); g.fillRect(dx - 18, dBase - 54, 9, 5); g.fillStyle(MX.purple, 1); g.fillRect(dx + 9, dBase - 54, 9, 5);
      for (const [x, color] of [[-14, MX.pink], [-6, MX.yellow], [2, MX.turquoise], [10, MX.green]] as const) {
        g.fillStyle(INK, 1); g.fillRect(dx + x - 1, dBase - 93, 8, 11);
        g.fillStyle(color, 1); g.fillRect(dx + x, dBase - 92, 6, 9);
      }
      g.fillStyle(INK, 1); g.fillRect(dx - 7, dBase - 74, 4, 4); g.fillRect(dx + 3, dBase - 74, 4, 4);
      g.fillStyle(MX.red, 1); g.fillRect(dx - 3, dBase - 66, 6, 3);
      g.fillStyle(0xe995a7, 1); g.fillRect(dx - 11, dBase - 69, 4, 3); g.fillRect(dx + 7, dBase - 69, 4, 3);

      // Balero sobre el tapete, frente a la mascota.
      const bx = 328, by = floorY + 46;
      this.box(g, bx, by, 30, 6, 0x8b5a2b, 2);
      g.fillStyle(MX.red, 1); g.fillRect(bx - 4, by - 1, 5, 8);
      g.lineStyle(2, 0xfff3d6, 1);
      g.lineBetween(bx + 30, by + 3, bx + 36, by - 6); g.lineBetween(bx + 36, by - 6, bx + 40, by - 10);
      this.blob(g, bx + 46, by - 16, 24, 24, MX.red);
      g.fillStyle(MX.yellow, 1); g.fillRect(bx + 34, by - 19, 24, 5);
      g.fillStyle(MX.green, 1); g.fillRect(bx + 34, by - 12, 24, 3);
      g.fillStyle(INK, 1); g.fillCircle(bx + 46, by - 22, 3);
      return g;
    }

    /** Piñata de estrella colgando; se balancea con un tween. */
    private drawPinata() {
      const g = this.add.graphics();
      const cones = [MX.orange, MX.turquoise, MX.yellow, MX.green, MX.purple];
      g.lineStyle(2, INK, 1); g.lineBetween(0, 0, 0, 48);
      for (let i = 0; i < 5; i += 1) {
        const a = Phaser.Math.DegToRad(-90 + i * 72);
        const tip = { x: Math.cos(a) * 46, y: 70 + Math.sin(a) * 46 };
        const l = { x: Math.cos(a - 0.5) * 16, y: 70 + Math.sin(a - 0.5) * 16 };
        const r = { x: Math.cos(a + 0.5) * 16, y: 70 + Math.sin(a + 0.5) * 16 };
        g.fillStyle(INK, 1); g.fillTriangle(l.x * 1.15, l.y + (l.y - 70) * 0.15, r.x * 1.15, r.y + (r.y - 70) * 0.15, tip.x * 1.08, 70 + (tip.y - 70) * 1.08);
        g.fillStyle(cones[i], 1); g.fillTriangle(l.x, l.y, r.x, r.y, tip.x, tip.y);
        g.fillStyle(MX.pink, 1); g.fillRect(tip.x - 3, tip.y - 3, 6, 6);
      }
      g.fillStyle(INK, 1); g.fillCircle(0, 70, 21);
      g.fillStyle(MX.pink, 1); g.fillCircle(0, 70, 18);
      g.fillStyle(MX.yellow, 1); g.fillRect(-14, 66, 28, 4);
      g.fillStyle(MX.turquoise, 1); g.fillRect(-14, 74, 28, 4);
      g.fillStyle(MX.red, 1); g.fillRect(-4, 90, 3, 26); g.fillStyle(MX.blue, 1); g.fillRect(2, 90, 3, 20);
      const pinata = this.add.container(W * 0.875, 8, [g]);
      this.tweens.add({ targets: pinata, angle: { from: -6, to: 6 }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      return pinata;
    }

    private drawBath() {
      const g = this.add.graphics();
      const floorY = Math.round(H * 0.72);
      // Baño con pared de talavera y piso de barro.
      for (let y = 0; y < floorY; y += 40) for (let x = 0; x < W; x += 40) this.talaveraTile(g, x, y, 40);
      g.fillStyle(INK, 1); g.fillRect(0, floorY, W, 4);
      g.fillStyle(0xc0643c, 1); g.fillRect(0, floorY + 4, W, H);
      g.fillStyle(0x9c4a29, 1);
      for (let x = 0; x < W; x += 48) g.fillRect(x, floorY + 4, 3, H);
      for (let y = floorY + 34; y < H; y += 30) g.fillRect(0, y, W, 3);
      g.fillStyle(0x7fd3e0, 1); g.fillRect(W * 0.2, H * 0.52, W * 0.6, 30);
      return g;
    }

    private drawTubFront() {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1); g.fillRoundedRect(W * 0.17, H * 0.6, W * 0.66, H * 0.28, 26);
      g.lineStyle(3, 0xa9cfd6, 1); g.strokeRoundedRect(W * 0.17, H * 0.6, W * 0.66, H * 0.28, 26);
      g.fillStyle(0xffffff, 0.95);
      for (const [x, r] of [[0.25, 16], [0.34, 20], [0.46, 14], [0.58, 19], [0.7, 15], [0.77, 12]] as const) g.fillCircle(W * x, H * 0.6, r);
      g.fillStyle(0x9c8f86, 1); g.fillRect(W * 0.24, H * 0.88, 10, 16); g.fillRect(W * 0.74, H * 0.88, 10, 16);
      return g;
    }

    private drawSponge() {
      const g = this.add.graphics();
      g.fillStyle(0xf6d36b, 1); g.fillRoundedRect(-SPONGE_R, -SPONGE_R * 0.7, SPONGE_R * 2, SPONGE_R * 1.4, 8);
      g.lineStyle(2, 0xc9a23f, 1); g.strokeRoundedRect(-SPONGE_R, -SPONGE_R * 0.7, SPONGE_R * 2, SPONGE_R * 1.4, 8);
      g.fillStyle(0xd9b24c, 1);
      for (const [x, y] of [[-10, -5], [6, -8], [12, 5], [-4, 7]] as const) g.fillCircle(x, y, 2.5);
      return this.add.container(W * 0.78, H * 0.35, [g]);
    }
  }

  const scene = new RoomScene();
  new Phaser.Game({
    type: Phaser.AUTO, parent, width: Math.round(W * PIXEL), height: Math.round(H * PIXEL), backgroundColor: '#c9d3de',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene], render: { pixelArt: true, antialias: false, roundPixels: true },
  });
  return {
    show: (view) => scene.show(view),
    react: (icon, kind) => scene.react(icon, kind),
    resetBath: () => scene.resetBath(),
    setRoomColors: (colors) => scene.setRoomColors(colors),
    setDecor: (decor) => scene.setDecor(decor),
    setAccessory: (icon, wear, slot) => scene.setAccessory(icon, wear, slot),
    setOutfit: (wear) => scene.setOutfit(wear),
    playInRoom: (onEnd) => scene.playInRoom(onEnd),
    isPlaying: () => scene.isPlaying(),
    onPet: (handler) => scene.onPet(handler),
  };
}
