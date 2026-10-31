import Phaser from 'phaser';
import type { PetAnim } from './animations.ts';
import { assetUrl, BACKGROUNDS, backgroundUrl, spriteKey, SPRITES } from './assets.ts';
import { findPet } from './catalog.ts';
import { scrubProgress, spongeTouchesPet } from './sponge.ts';
import type { PetId, Stage } from './types.ts';

// Escena de la habitación. Solo dibuja y anima; las reglas viven en petState.ts.
// Si no hay sprite para la mascota, etapa y animación, dibuja el marcador temporal con formas.

export interface SceneView { petId: PetId; stage: Stage; anim: PetAnim }

export interface PetSceneHandle {
  show(view: SceneView): void;
  /** Rebote y un emoji que flota (comer, beber o jugar). */
  react(icon: string): void;
  /** Reinicia el progreso del baño a 0. */
  resetBath(): void;
  /** Colores de pared de la habitación, para que combinen con el tema de la mascota. */
  setRoomColors(colors: RoomColors): void;
}

export interface RoomColors { wall: number; stripe: number }

const W = 520;
const H = 360;
/** La escena se dibuja a esta fracción de resolución y se amplía sin suavizado: píxeles grandes. */
const PIXEL = 0.4;
const ROOM_POS = { x: W / 2, y: 190 };
const BATH_POS = { x: W / 2, y: 205 };
const STAGE_SCALE: Record<Stage, number> = { baby: 0.6, teen: 0.8, adult: 1 };
const BODY = { rx: 61, ry: 56, offsetY: 8 };
const SPONGE_R = 22;
const DEAD_COLORS = { color: 0xb8b2bd, outline: 0x8a8490, belly: 0xd6d2da };
/** Paleta mexicana de la decoración (papel picado, talavera, sarape, piñata). */
const MX = {
  pink: 0xe4007c, orange: 0xff8c1a, yellow: 0xffd23f, green: 0x2e9e4f,
  turquoise: 0x00a6a6, blue: 0x1f4fa3, purple: 0x7b2d8e, red: 0xd7263d,
};
const INK = 0x302b43;

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
      for (const s of SPRITES) {
        const key = spriteKey(s.petId, s.stage, s.anim);
        if (!this.textures.exists(key)) continue;
        this.anims.create({ key, frames: this.anims.generateFrameNumbers(key, {
          ...(s.firstFrame === undefined ? {} : { start: s.firstFrame }),
          ...(s.lastFrame === undefined ? {} : { end: s.lastFrame }),
        }), frameRate: s.fps, repeat: s.loop === false ? 0 : -1 });
      }

      this.roomLayer = this.add.container(0, 0, [this.textures.exists('bg-room') ? this.add.image(W / 2, H / 2, 'bg-room').setDisplaySize(W, H) : this.drawRoom(), this.drawPinata()]);
      this.bathLayer = this.add.container(0, 0, [this.textures.exists('bg-bath') ? this.add.image(W / 2, H / 2, 'bg-bath').setDisplaySize(W, H) : this.drawBath()]).setVisible(false);

      this.body = this.add.ellipse(0, BODY.offsetY, BODY.rx * 2, BODY.ry * 2, 0xffffff);
      this.belly = this.add.ellipse(0, 28, 72, 56, 0xffffff);
      this.ears = [this.add.ellipse(-47, -42, 31, 43, 0xffffff).setAngle(-24), this.add.ellipse(47, -42, 31, 43, 0xffffff).setAngle(24)];
      this.blush = [this.add.ellipse(-40, 10, 16, 8, 0xe995a7, 0.75), this.add.ellipse(40, 10, 16, 8, 0xe995a7, 0.75)];
      this.face = this.add.graphics();
      this.placeholder = this.add.container(0, 0, [...this.ears, this.body, this.belly, ...this.blush, this.face]);
      this.sprite = this.add.sprite(0, 0, '__DEFAULT').setVisible(false);
      this.bobber = this.add.container(0, 0, [this.placeholder, this.sprite]);
      this.petRoot = this.add.container(ROOM_POS.x, ROOM_POS.y, [this.bobber]);
      this.bob = this.tweens.add({ targets: this.bobber, y: -7, duration: 950, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

      this.tubFront = this.drawTubFront().setVisible(false);
      this.night = this.add.rectangle(W / 2, H / 2, W, H, 0x1c1834, 0.5).setVisible(false);
      this.zzz = this.add.text(W / 2 + 70, 95, 'Z z z', { fontFamily: 'system-ui, sans-serif', fontSize: '28px', fontStyle: 'bold', color: '#fff6d8' }).setVisible(false);
      this.tweens.add({ targets: this.zzz, y: 80, alpha: 0.4, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.sponge = this.drawSponge().setVisible(false);

      this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.moveSponge(pointer.worldX, pointer.worldY));
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.moveSponge(pointer.worldX, pointer.worldY, true));

      this.ready = true;
      if (this.view) this.apply(this.view);
    }

    show(view: SceneView) {
      this.view = view;
      if (this.ready) this.apply(view);
    }

    react(icon: string) {
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
      this.petRoot.setPosition(pos.x, pos.y).setScale(scale);
      this.game.canvas.style.touchAction = bathing ? 'none' : 'auto';

      if (view.anim === 'dead') { this.bob.pause(); this.bobber.y = 0; } else { this.bob.resume(); }
      this.bob.timeScale = view.anim === 'sleep' ? 0.45 : 1;

      const key = `${view.petId}|${view.stage}|${view.anim}`;
      if (key === this.drawnKey) return;
      this.drawnKey = key;

      const spriteAnim = this.findSprite(view);
      this.sprite.setVisible(spriteAnim !== null);
      this.placeholder.setVisible(spriteAnim === null);
      if (spriteAnim) {
        this.sprite.play(spriteAnim.key);
        // Misma altura visual que el marcador para que la escena no cambie al llegar los assets.
        this.sprite.setScale((BODY.ry * 2.4) / spriteAnim.frameHeight);
        return;
      }
      this.paintPlaceholder(view);
    }

    private findSprite(view: SceneView): { key: string; frameHeight: number } | null {
      for (const anim of [view.anim, 'idle'] as const) {
        const key = spriteKey(view.petId, view.stage, anim);
        const sheet = SPRITES.find((s) => s.petId === view.petId && s.stage === view.stage && s.anim === anim);
        if (sheet && this.anims.exists(key)) return { key, frameHeight: sheet.frameHeight };
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
      // Pared con franjas (color del tema).
      g.fillStyle(this.roomColors.wall, 1); g.fillRect(0, 0, W, H);
      g.fillStyle(this.roomColors.stripe, 1);
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
      // Piso de tablas.
      g.fillStyle(0x8e5a3a, 1); g.fillRect(0, floorY + 5, W, H);
      g.fillStyle(0x6f4329, 1);
      for (let y = floorY + 25; y < H; y += 22) g.fillRect(0, y, W, 3);
      // Tapete de sarape debajo de la mascota.
      const rx = 150, ry = floorY + 16, rw = 220, rh = 52;
      const stripes = [MX.red, MX.orange, MX.yellow, MX.green, MX.turquoise, MX.blue, MX.purple, MX.pink];
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
      this.papelPicado(g, this.roomColors.wall);
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
    react: (icon) => scene.react(icon),
    resetBath: () => scene.resetBath(),
    setRoomColors: (colors) => scene.setRoomColors(colors),
  };
}
