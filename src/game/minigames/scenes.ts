// Escenas Phaser de los minijuegos. Solo dibujan y cuentan puntos; las recompensas las decide
// rules.ts y las aplica el controlador cuando termina la partida.
import Phaser from 'phaser';
import { assetUrl, portraitUrl, SPRITES } from '../assets.ts';
import { findPet } from '../catalog.ts';
import type { PetId, Stage } from '../types.ts';
import { CATCH_SECONDS, PONG_COIN_EVERY_MS, PONG_LIVES, PONG_MAX_SECONDS, type MiniGameId, type MiniGameResult } from './rules.ts';

const W = 520;
const H = 360;
const INK = '#302b43';

export interface MiniGameOptions {
  game: MiniGameId;
  petId: PetId;
  stage: Stage;
  /** Habilidad de la mascota en ping pong (rules.pongSkill). */
  skill: number;
  colors: { wall: number; floor: number };
  onEnd(result: MiniGameResult): void;
}

export interface MiniGameHandle {
  destroy(): void;
}

/** La ilustración de la etapa (la hoja del ajolote bebé tiene cuadros, se usa su retrato). */
function petImageUrl(petId: PetId, stage: Stage): string {
  const sheet = SPRITES.find((s) => s.petId === petId && s.stage === stage && s.anim === 'idle');
  if (sheet && sheet.frameWidth === sheet.frameHeight) return assetUrl(sheet.file);
  return portraitUrl(findPet(petId)?.slug ?? 'axolotl');
}

const hudStyle = { fontFamily: '"Press Start 2P", monospace', fontSize: '14px', color: '#fff7e6', stroke: INK, strokeThickness: 6 };

abstract class BaseGame extends Phaser.Scene {
  protected pet!: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
  protected hud!: Phaser.GameObjects.Text;
  protected score = 0;
  protected coins = 0;
  protected running = false;
  protected elapsed = 0;
  protected targetX = W / 2;
  private keys: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private ended = false;

  constructor(key: string, protected opts: MiniGameOptions) { super(key); }

  preload() {
    this.load.on('loaderror', () => { /* sin imagen se usa un emoji */ });
    this.load.image('pet', petImageUrl(this.opts.petId, this.opts.stage));
  }

  /** Fondo, mascota, marcador, controles y la cuenta regresiva. */
  protected setup(petY: number, petHeight: number) {
    const g = this.add.graphics();
    g.fillStyle(this.opts.colors.wall, 1).fillRect(0, 0, W, H);
    g.fillStyle(this.opts.colors.floor, 1).fillRect(0, H - 40, W, 40);
    g.fillStyle(0x302b43, 1).fillRect(0, H - 44, W, 4);
    this.pet = this.textures.exists('pet')
      ? this.add.image(W / 2, petY, 'pet').setScale(petHeight / this.textures.get('pet').getSourceImage().height)
      : this.add.text(W / 2, petY, findPet(this.opts.petId)?.label.slice(0, 1) ?? '🐾', { fontSize: `${petHeight * 0.7}px` }).setOrigin(0.5);
    this.hud = this.add.text(12, 10, '', hudStyle).setDepth(10);
    this.keys = this.input.keyboard?.createCursorKeys() ?? null;
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { this.targetX = p.worldX; });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { this.targetX = p.worldX; });
    const count = this.add.text(W / 2, H / 2, '¡LISTOS!', { ...hudStyle, fontSize: '28px' }).setOrigin(0.5).setDepth(10);
    this.time.delayedCall(1100, () => { count.destroy(); this.running = true; });
  }

  /** Posición x controlada por el dedo, el mouse o las flechas. */
  protected steer(x: number, delta: number, speed: number, half: number): number {
    if (this.keys?.left.isDown) this.targetX = x - speed * (delta / 1000) * 1.5;
    if (this.keys?.right.isDown) this.targetX = x + speed * (delta / 1000) * 1.5;
    this.targetX = Phaser.Math.Clamp(this.targetX, half, W - half);
    const step = speed * (delta / 1000);
    return Math.abs(this.targetX - x) <= step ? this.targetX : x + Math.sign(this.targetX - x) * step;
  }

  protected popText(x: number, y: number, text: string, color = '#ffd23f') {
    const t = this.add.text(x, y, text, { ...hudStyle, fontSize: '16px', color }).setOrigin(0.5).setDepth(9);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  protected finish() {
    if (this.ended) return;
    this.ended = true;
    this.running = false;
    const banner = this.add.text(W / 2, H / 2, '¡FIN!', { ...hudStyle, fontSize: '32px' }).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: banner, scale: 1.2, duration: 250, yoyo: true });
    this.time.delayedCall(900, () => this.opts.onEnd({ game: this.opts.game, score: Math.max(0, this.score), coins: this.coins }));
  }
}

/* ----------------------------------------------------- atrapa la fruta */

const FRUITS = ['🍎', '🍓', '🍌', '🍊', '🍇', '🍉'];

class CatchGame extends BaseGame {
  private items: Array<{ obj: Phaser.GameObjects.Text; kind: 'fruit' | 'coin' | 'chile'; speed: number }> = [];
  private spawnIn = 0;

  constructor(opts: MiniGameOptions) { super('catch', opts); }

  create() { this.setup(H - 82, 84); this.drawHud(); }

  private drawHud() {
    this.hud.setText(`⏱ ${Math.max(0, Math.ceil(CATCH_SECONDS - this.elapsed / 1000))}   ⭐ ${this.score}   🪙 ${this.coins}`);
  }

  update(_t: number, delta: number) {
    if (!this.running) return;
    this.elapsed += delta;
    const progress = Math.min(1, this.elapsed / (CATCH_SECONDS * 1000));
    this.pet.x = this.steer(this.pet.x, delta, 420, 40);

    this.spawnIn -= delta;
    if (this.spawnIn <= 0) {
      this.spawnIn = 650 - 300 * progress;
      const r = Math.random();
      const kind = r < 0.6 ? 'fruit' : r < 0.82 ? 'coin' : 'chile';
      const icon = kind === 'fruit' ? Phaser.Utils.Array.GetRandom(FRUITS) : kind === 'coin' ? '🪙' : '🌶️';
      const obj = this.add.text(Phaser.Math.Between(24, W - 24), -20, icon, { fontSize: '30px' }).setOrigin(0.5);
      this.items.push({ obj, kind, speed: 120 + 140 * progress + Math.random() * 40 });
    }

    for (const item of [...this.items]) {
      item.obj.y += item.speed * (delta / 1000);
      const caught = Math.abs(item.obj.x - this.pet.x) < 46 && Math.abs(item.obj.y - (this.pet.y - 18)) < 34;
      if (caught) {
        if (item.kind === 'fruit') { this.score += 1; this.popText(item.obj.x, item.obj.y, '+1'); }
        else if (item.kind === 'coin') { this.coins += 1; this.score += 1; this.popText(item.obj.x, item.obj.y, '+🪙'); }
        else { this.score -= 2; this.popText(item.obj.x, item.obj.y, '-2', '#ff6b6b'); this.cameras.main.shake(180, 0.01); }
        this.tweens.add({ targets: this.pet, scaleY: this.pet.scaleY * 0.9, duration: 70, yoyo: true });
      }
      if (caught || item.obj.y > H + 20) {
        item.obj.destroy();
        this.items.splice(this.items.indexOf(item), 1);
      }
    }
    this.drawHud();
    if (this.elapsed >= CATCH_SECONDS * 1000) this.finish();
  }
}

/* ------------------------------------------------------------ ping pong */

class PongGame extends BaseGame {
  private paddle!: Phaser.GameObjects.Rectangle;
  private ball!: Phaser.GameObjects.Arc;
  private vx = 0;
  private vy = 0;
  private lives = PONG_LIVES;
  private serveIn = 0;
  /** Tiempo con la pelota en juego desde la última moneda. */
  private coinTimer = 0;
  /** Error de puntería de la mascota en esta jugada; con más habilidad, más pequeño. */
  private aim = 0;

  constructor(opts: MiniGameOptions) { super('pong', opts); }

  create() {
    this.setup(64, 70);
    this.paddle = this.add.rectangle(W / 2, H - 58, 96, 14, 0xffd23f).setStrokeStyle(4, 0x302b43);
    this.ball = this.add.circle(W / 2, H / 2, 9, 0xfff7e6).setStrokeStyle(4, 0x302b43);
    this.serve(1);
    this.drawHud();
  }

  private drawHud() {
    const next = Math.ceil((PONG_COIN_EVERY_MS - this.coinTimer) / 1000);
    this.hud.setText(`${'❤'.repeat(this.lives)}${'·'.repeat(PONG_LIVES - this.lives)}  ⭐ ${this.score}  🪙 ${this.coins} (+1 en ${next}s)`);
  }

  /** Saca hacia el jugador (dir 1) o hacia la mascota (-1). */
  private serve(dir: 1 | -1) {
    this.ball.setPosition(W / 2, H / 2);
    const angle = Phaser.Math.FloatBetween(-0.5, 0.5);
    this.vx = Math.sin(angle) * 240;
    this.vy = Math.cos(angle) * 240 * dir;
    this.serveIn = 700;
    this.newAim();
  }

  private newAim() {
    this.aim = Phaser.Math.FloatBetween(-1, 1) * (1 - this.opts.skill) * 90;
  }

  update(_t: number, delta: number) {
    if (!this.running) return;
    this.elapsed += delta;
    const dt = delta / 1000;
    this.paddle.x = this.steer(this.paddle.x, delta, 640, 48);

    // La mascota sigue la pelota con su velocidad y su error de puntería.
    const petSpeed = 140 + 260 * this.opts.skill;
    const goal = Phaser.Math.Clamp(this.ball.x + this.aim, 36, W - 36);
    const step = petSpeed * dt;
    this.pet.x = Math.abs(goal - this.pet.x) <= step ? goal : this.pet.x + Math.sign(goal - this.pet.x) * step;

    if (this.serveIn > 0) { this.serveIn -= delta; return; }
    // Pesitos por tiempo: +1 cada PONG_COIN_EVERY_MS con la pelota en juego.
    this.coinTimer += delta;
    if (this.coinTimer >= PONG_COIN_EVERY_MS) {
      this.coinTimer -= PONG_COIN_EVERY_MS;
      this.coins += 1;
      this.popText(this.paddle.x, this.paddle.y - 26, '+🪙');
    }
    this.ball.x += this.vx * dt;
    this.ball.y += this.vy * dt;
    if (this.ball.x < 10 || this.ball.x > W - 10) { this.vx = -this.vx; this.ball.x = Phaser.Math.Clamp(this.ball.x, 10, W - 10); }

    const speed = Math.min(560, Math.hypot(this.vx, this.vy));
    // Golpe del jugador.
    if (this.vy > 0 && this.ball.y >= this.paddle.y - 14 && this.ball.y <= this.paddle.y + 4 && Math.abs(this.ball.x - this.paddle.x) < 56) {
      const offset = (this.ball.x - this.paddle.x) / 56;
      const next = Math.min(560, speed * 1.06);
      this.vx = offset * next * 0.75;
      this.vy = -Math.sqrt(Math.max(1, next * next - this.vx * this.vx));
      this.newAim();
      this.tweens.add({ targets: this.paddle, scaleY: 1.4, duration: 60, yoyo: true });
    }
    // Golpe de la mascota.
    if (this.vy < 0 && this.ball.y <= this.pet.y + 32 && this.ball.y >= this.pet.y - 10 && Math.abs(this.ball.x - this.pet.x) < 46) {
      this.vy = Math.abs(this.vy);
      this.vx += Phaser.Math.FloatBetween(-60, 60);
      this.tweens.add({ targets: this.pet, angle: Phaser.Math.Between(-12, 12), duration: 90, yoyo: true });
    }
    // Punto para ti: a la mascota se le pasó.
    if (this.ball.y < -12) {
      this.score += 1;
      this.popText(this.pet.x, this.pet.y + 30, '+1 ⭐');
      this.serve(1);
    }
    // Fallo tuyo.
    if (this.ball.y > H + 12) {
      this.lives -= 1;
      this.cameras.main.shake(180, 0.01);
      if (this.lives <= 0) { this.drawHud(); this.finish(); return; }
      this.serve(1);
    }
    this.drawHud();
    if (this.elapsed >= PONG_MAX_SECONDS * 1000) this.finish();
  }
}

/** Crea la partida dentro de `host`. Llamar destroy() al cerrar. */
export function startMiniGame(host: HTMLElement, opts: MiniGameOptions): MiniGameHandle {
  const scene = opts.game === 'catch' ? new CatchGame(opts) : new PongGame(opts);
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent: host, width: W, height: H, backgroundColor: '#302b43',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene], render: { pixelArt: true, antialias: false, roundPixels: true },
    input: { keyboard: true },
  });
  return { destroy: () => game.destroy(true) };
}
