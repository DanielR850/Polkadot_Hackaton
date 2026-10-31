import Phaser from 'phaser';

export function createPetScene(parent: HTMLElement) {
  class RoomScene extends Phaser.Scene {
    private pet?: Phaser.GameObjects.Sprite;
    private actionVersion = 0;

    constructor() { super('room'); }

    preload() {
      this.load.spritesheet('axolotl', './assets/pets/axolotl/animations.png', {
        frameWidth: 356,
        frameHeight: 276,
      });
    }

    create() {
      const { width, height } = this.scale;
      const graphics = this.add.graphics();
      graphics.fillGradientStyle(0xf7e8ce, 0xf7e8ce, 0xe9d6bc, 0xe9d6bc, 1);
      graphics.fillRect(0, 0, width, height);
      graphics.fillStyle(0xd1b292, 1); graphics.fillRect(0, height * 0.82, width, height * 0.18);
      graphics.fillStyle(0xfff7e8, 0.82); graphics.fillCircle(width * 0.18, height * 0.2, 42);
      graphics.fillStyle(0xf0b8a1, 0.5); graphics.fillCircle(width * 0.18, height * 0.2, 32);
      // Plant pot
      graphics.fillStyle(0x9c705e, 1); graphics.fillRoundedRect(width * 0.78, height * 0.65, 42, 38, 7);
      graphics.fillStyle(0x6f9b70, 1); graphics.fillCircle(width * 0.82, height * 0.57, 17); graphics.fillCircle(width * 0.77, height * 0.6, 13); graphics.fillCircle(width * 0.86, height * 0.61, 12);

      this.anims.create({
        key: 'axolotl-idle',
        frames: this.anims.generateFrameNumbers('axolotl', { start: 0, end: 3 }),
        frameRate: 4,
        repeat: -1,
      });
      this.anims.create({
        key: 'axolotl-happy',
        frames: this.anims.generateFrameNumbers('axolotl', { start: 4, end: 7 }),
        frameRate: 7,
        repeat: -1,
      });
      this.anims.create({
        key: 'axolotl-eating',
        frames: this.anims.generateFrameNumbers('axolotl', { start: 8, end: 11 }),
        frameRate: 6,
        repeat: -1,
      });
      this.anims.create({
        key: 'axolotl-sleeping',
        frames: this.anims.generateFrameNumbers('axolotl', { start: 12, end: 15 }),
        frameRate: 3,
        repeat: -1,
      });

      this.pet = this.add.sprite(width * 0.5, height * 0.52, 'axolotl')
        .setDisplaySize(210, 163)
        .play('axolotl-idle');
      this.tweens.add({ targets: this.pet, y: this.pet.y - 4, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.scale.on('resize', (size: Phaser.Structs.Size) => this.pet?.setPosition(size.width * 0.5, size.height * 0.52));
    }

    react(action: string) {
      if (!this.pet) return;
      const animation = action === 'feed' ? 'axolotl-eating' : action === 'sleep' ? 'axolotl-sleeping' : 'axolotl-happy';
      const duration = action === 'sleep' ? 2600 : 1500;
      this.pet.play(animation, true);
      const version = ++this.actionVersion;
      this.time.delayedCall(duration, () => {
        if (version !== this.actionVersion) return;
        this.pet?.play('axolotl-idle', true);
      });
      this.tweens.killTweensOf(this.pet);
      this.tweens.add({ targets: this.pet, scale: this.pet.scale * 1.05, duration: 180, yoyo: true, ease: 'Back.Out' });
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width: 520, height: 360, backgroundColor: '#f7e8ce',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [RoomScene], pixelArt: true,
  });
  return {
    react: (action: string) => (game.scene.getScene('room') as RoomScene).react(action),
    destroy: () => game.destroy(true),
  };
}
